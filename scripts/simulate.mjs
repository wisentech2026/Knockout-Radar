// scripts/simulate.mjs
// 2026 世界杯 Monte Carlo 模拟引擎
// 输入：data/fixtures.json（openfootball 真实赛程，含已赛比分）+ data/teams.json（Elo 快照）
// 输出：data.json（页面唯一数据源）
//
// 模型：
//   小组赛 —— 双方进球数服从泊松分布，强度由 Elo 差驱动；已有真实比分的场次直接采用。
//   出线 —— 12 组前二 + 8 个成绩最好的第三名；第三名落位用赛程中的分组约束做匹配。
//   淘汰赛 —— Elo 期望胜率；常规时间打平后进入加时/点球，胜率向 50% 压缩 40%。
//   主场 —— 三个东道主在 host 场景下 +50 Elo。
// 运行：node scripts/simulate.mjs [--sims 10000]

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(readFileSync(join(root, "data/fixtures.json"), "utf8"));
const teamData = JSON.parse(readFileSync(join(root, "data/teams.json"), "utf8"));

const SIMS = Number(process.argv[process.argv.indexOf("--sims") + 1]) || 10000;
const HOST_BONUS = 50;        // 东道主在本国场地比赛时生效（按场地逐场判定）
const ALTITUDE_BONUS = 25;    // 墨西哥城海拔 2240m，墨西哥队在 Azteca 的额外加成
const PENALTY_COMPRESS = 0.6; // 点球大战：胜率 = 0.5 + (E - 0.5) * 0.6
const GOAL_SCALE = 500;       // 泊松强度缩放（数值标定：使模型隐含胜率贴合 Elo 期望）
const DC_RHO = -0.1;          // Dixon-Coles 低比分相关性修正
const ELO_K = 60;             // 世界杯决赛圈 Elo 更新系数（World Football Elo 口径）

// 场地 → 国别（东道主主场判定）
function groundCountry(ground) {
  if (/Mexico City|Guadalajara|Monterrey/.test(ground)) return "MEX";
  if (/Toronto|Vancouver/.test(ground)) return "CAN";
  return "USA";
}
const HOST_COUNTRY = { Mexico: "MEX", Canada: "CAN", USA: "USA" };

// ---------- 队伍索引 ----------
const teams = teamData.teams.map((t, i) => ({ ...t, id: i }));
const byEn = new Map(teams.map((t) => [t.en, t]));
const N = teams.length;
// 注意：eloRank 与 Top8 在 liveElo 计算之后再确定（见下方 reorderByLiveElo）
let eloRankOrder, TOP8;
function reorderByLiveElo() {
  eloRankOrder = [...teams].sort((a, b) => b.eloLive - a.eloLive);
  eloRankOrder.forEach((t, i) => (t.eloRank = i + 1));
  TOP8 = new Set(eloRankOrder.slice(0, 8).map((t) => t.id));
}

// ---------- 赛程解析 ----------
const groupMatches = fixtures.matches.filter((m) => m.group);
const groups = {};
for (const m of groupMatches) {
  const g = m.group.replace("Group ", "");
  groups[g] ??= new Set();
  groups[g].add(byEn.get(m.team1).id);
  groups[g].add(byEn.get(m.team2).id);
}
const groupNames = Object.keys(groups).sort();

// 淘汰赛树：num -> { a, b }，引用形如 "1A" "2B" "3A/B/C/D/F" "W73"
const koMatches = [];
let autoNum = 103;
for (const m of fixtures.matches) {
  if (m.group) continue;
  if (m.round === "Match for third place") continue;
  const num = m.num ?? autoNum++;
  koMatches.push({ num: m.round === "Final" ? 104 : num, round: m.round, a: m.team1, b: m.team2, ground: m.ground });
}
koMatches.sort((x, y) => x.num - y.num);

// 32 强里 8 个第三名槽位的分组约束
const thirdSlots = [];
for (const m of koMatches) {
  for (const side of ["a", "b"]) {
    if (/^3/.test(m[side])) {
      thirdSlots.push({ match: m.num, side, allowed: new Set(m[side].slice(1).split("/")) });
    }
  }
}

// 上下半区（从半决赛沿胜者引用向上回溯）
function ancestors(num, acc = new Set()) {
  const m = koMatches.find((x) => x.num === num);
  if (!m) return acc;
  acc.add(num);
  for (const side of ["a", "b"]) {
    const ref = m[side];
    if (/^W(\d+)$/.test(ref)) ancestors(Number(ref.slice(1)), acc);
  }
  return acc;
}
const upperHalf = ancestors(101); // 半决赛 101 的全部上游

// ---------- 赛中 Elo 动态更新 ----------
// 已赛场次按日期顺序回放，按 World Elo 规则更新实力值；模拟使用更新后的 liveElo。
const liveElo = new Float64Array(N);
teams.forEach((t) => (liveElo[t.id] = t.elo));
const playedSorted = groupMatches
  .filter((m) => m.score?.ft)
  .sort((a, b) => (a.date < b.date ? -1 : 1));
for (const m of playedSorted) {
  const t1 = byEn.get(m.team1), t2 = byEn.get(m.team2);
  const [g1, g2] = m.score.ft;
  const W1 = g1 > g2 ? 1 : g1 === g2 ? 0.5 : 0;
  const diff = Math.abs(g1 - g2);
  const G = diff <= 1 ? 1 : diff === 2 ? 1.5 : (11 + diff) / 8;
  const We = eloExpect(liveElo[t1.id] - liveElo[t2.id]);
  const delta = ELO_K * G * (W1 - We);
  liveElo[t1.id] += delta;
  liveElo[t2.id] -= delta;
}
teams.forEach((t) => (t.eloLive = Math.round(liveElo[t.id])));
reorderByLiveElo();

// ---------- 概率工具 ----------
function eloExpect(d) {
  return 1 / (1 + Math.pow(10, -d / 400));
}
function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}
function goalMeans(dElo) {
  // 双方期望进球：基准 1.3，随 Elo 差指数缩放（GOAL_SCALE 经数值标定），限制在 [0.25, 3.4]
  const m1 = Math.min(3.4, Math.max(0.25, 1.3 * Math.exp(dElo / GOAL_SCALE)));
  const m2 = Math.min(3.4, Math.max(0.25, 1.3 * Math.exp(-dElo / GOAL_SCALE)));
  return [m1, m2];
}

// Dixon-Coles 修正后的比分分布（9×9 网格 CDF，按量化的 λ 对缓存）
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
const gridCache = new Map();
function scoreGrid(la, lb) {
  const key = `${Math.round(la * 20)}|${Math.round(lb * 20)}`;
  let cdf = gridCache.get(key);
  if (cdf) return cdf;
  const pa = [], pb = [];
  for (let k = 0; k <= 8; k++) {
    pa.push(Math.exp(-la) * Math.pow(la, k) / FACT[k]);
    pb.push(Math.exp(-lb) * Math.pow(lb, k) / FACT[k]);
  }
  cdf = [];
  let acc = 0;
  for (let i = 0; i <= 8; i++)
    for (let j = 0; j <= 8; j++) {
      let p = pa[i] * pb[j];
      if (i === 0 && j === 0) p *= 1 - la * lb * DC_RHO;
      else if (i === 1 && j === 0) p *= 1 + lb * DC_RHO;
      else if (i === 0 && j === 1) p *= 1 + la * DC_RHO;
      else if (i === 1 && j === 1) p *= 1 - DC_RHO;
      acc += p;
      cdf.push([acc, i, j]);
    }
  const total = acc;
  for (const row of cdf) row[0] /= total;
  gridCache.set(key, cdf);
  return cdf;
}
function sampleScore(la, lb) {
  const cdf = scoreGrid(la, lb);
  const r = Math.random();
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid][0] < r) lo = mid + 1; else hi = mid;
  }
  return [cdf[lo][1], cdf[lo][2]];
}

// ---------- 单次模拟 ----------
function effElo(t, opt, ground) {
  let e = liveElo[t.id];
  if (opt.host && t.host && ground && HOST_COUNTRY[t.en] === groundCountry(ground)) {
    e += HOST_BONUS;
    if (t.en === "Mexico" && /Mexico City/.test(ground)) e += ALTITUDE_BONUS;
  }
  if (opt.weather) e += t.weatherAdj || 0;
  return e;
}

function playGroup(opt) {
  // 返回每组排序后的 id 数组 + 第三名战绩
  const stats = teams.map(() => ({ pts: 0, gf: 0, ga: 0 }));
  for (const m of groupMatches) {
    const t1 = byEn.get(m.team1), t2 = byEn.get(m.team2);
    let g1, g2;
    if (m.score?.ft) {
      [g1, g2] = m.score.ft; // 真实比分（开赛后由数据管道写入）
    } else {
      const d = effElo(t1, opt, m.ground) - effElo(t2, opt, m.ground);
      const [m1, m2] = goalMeans(d);
      [g1, g2] = sampleScore(m1, m2);
    }
    stats[t1.id].gf += g1; stats[t1.id].ga += g2;
    stats[t2.id].gf += g2; stats[t2.id].ga += g1;
    if (g1 > g2) stats[t1.id].pts += 3;
    else if (g2 > g1) stats[t2.id].pts += 3;
    else { stats[t1.id].pts++; stats[t2.id].pts++; }
  }
  const rank = (ids) =>
    [...ids].sort((a, b) => {
      const A = stats[a], B = stats[b];
      return B.pts - A.pts || (B.gf - B.ga) - (A.gf - A.ga) || B.gf - A.gf || Math.random() - 0.5;
    });
  const table = {};
  for (const g of groupNames) table[g] = rank(groups[g]);
  return { table, stats };
}

function assignThirds(thirdIds, thirdGroups) {
  // 回溯匹配：8 个第三名 -> 8 个槽位，满足分组约束
  const slotFor = new Array(thirdSlots.length).fill(-1);
  const used = new Array(thirdIds.length).fill(false);
  function bt(s) {
    if (s === thirdSlots.length) return true;
    for (let i = 0; i < thirdIds.length; i++) {
      if (!used[i] && thirdSlots[s].allowed.has(thirdGroups[i])) {
        used[i] = true; slotFor[s] = i;
        if (bt(s + 1)) return true;
        used[i] = false;
      }
    }
    return false;
  }
  bt(0);
  return slotFor.map((i) => thirdIds[i]);
}

function playKnockout(table, stats, opt, rec) {
  // 第三名排序
  const thirds = groupNames.map((g) => table[g][2]);
  const ranked = [...thirds].sort((a, b) => {
    const A = stats[a], B = stats[b];
    return B.pts - A.pts || (B.gf - B.ga) - (A.gf - A.ga) || B.gf - A.gf || Math.random() - 0.5;
  });
  const best8 = ranked.slice(0, 8);
  const best8Groups = best8.map((id) => teams[id].group);
  const slotTeam = assignThirds(best8, best8Groups);

  const winner = {}; // num -> teamId
  let slotIdx = 0;
  const resolve = (ref) => {
    if (/^W(\d+)$/.test(ref)) return winner[Number(ref.slice(1))];
    if (/^3/.test(ref)) return slotTeam[slotIdx++];
    const pos = Number(ref[0]) - 1, g = ref[1];
    return table[g][pos];
  };

  for (const m of koMatches) {
    const a = resolve(m.a), b = resolve(m.b);
    rec.pair(m, a, b);
    const d = effElo(teams[a], opt, m.ground) - effElo(teams[b], opt, m.ground);
    const E = eloExpect(d);
    const [ma, mb] = goalMeans(d);
    const [ga, gb] = sampleScore(ma, mb);
    let w;
    if (ga !== gb) w = ga > gb ? a : b;
    else w = Math.random() < 0.5 + (E - 0.5) * PENALTY_COMPRESS ? a : b;
    winner[m.num] = w;
    rec.advance(m, a, b, w);
  }
  return winner;
}

// ---------- 统计容器 ----------
function makeRecorder() {
  const z = () => new Float64Array(N);
  const zz = () => Array.from({ length: N }, () => new Float64Array(N));
  const r = {
    p32: z(), p16: z(), p8: z(), p4: z(), pF: z(), pC: z(),
    g1: z(), g2: z(), g3: z(), upsetWins: z(),
    collision: z(), oppEloSum: z(), oppEloN: z(),
    qualPos(table) {
      for (const g in table) {
        this.g1[table[g][0]]++; this.g2[table[g][1]]++; this.g3[table[g][2]]++;
      }
    },
    meet: { r32: zz(), r16: zz(), r8: zz(), r4: zz() },
    r32opp: zz(),
    modal: new Map(), // num -> Map("a-b" -> count)
    modalWin: new Map(),
    stageOf(round) {
      if (round === "Round of 32") return "r32";
      if (round === "Round of 16") return "r16";
      if (round === "Quarter-final") return "r8";
      if (round === "Semi-final") return "r4";
      return null;
    },
    pair(m, a, b) {
      const s = this.stageOf(m.round);
      if (s) {
        this.meet[s][a][b]++; this.meet[s][b][a]++;
      }
      if (m.round === "Round of 32") {
        this.r32opp[a][b]++; this.r32opp[b][a]++;
        this.oppEloSum[a] += teams[b].eloLive; this.oppEloN[a]++;
        this.oppEloSum[b] += teams[a].eloLive; this.oppEloN[b]++;
        if (TOP8.has(b)) this.collision[a]++;
        if (TOP8.has(a)) this.collision[b]++;
      }
      const key = `${a}-${b}`;
      if (!this.modal.has(m.num)) this.modal.set(m.num, new Map());
      const mm = this.modal.get(m.num);
      mm.set(key, (mm.get(key) || 0) + 1);
    },
    advance(m, a, b, w) {
      const s = this.stageOf(m.round);
      if (s === "r32" || s === "r16") {
        const loser = w === a ? b : a;
        if (teams[w].eloLive < teams[loser].eloLive) this.upsetWins[w]++;
      }
      if (s === "r32") { this.p32[a]++; this.p32[b]++; this.p16[w]++; }
      if (s === "r16") this.p8[w]++;
      if (s === "r8") this.p4[w]++;
      if (s === "r4") this.pF[w]++;
      if (m.num === 104) this.pC[w]++;
      if (!this.modalWin.has(m.num)) this.modalWin.set(m.num, new Map());
      const mw = this.modalWin.get(m.num);
      mw.set(w, (mw.get(w) || 0) + 1);
    },
  };
  return r;
}

// 16 强阶段遇 Top8 的撞车也计入 collision：在 pair() 里只记了 32 强，这里补一个独立 pass
// （为保持单次遍历简单，16 强撞车并入 meet.r16 与 TOP8 的乘积，见汇总阶段）

// ---------- 主循环 ----------
function runScenario(opt) {
  const rec = makeRecorder();
  rec.opt = opt;
  for (let s = 0; s < SIMS; s++) {
    const { table, stats } = playGroup(opt);
    rec.qualPos(table);
    playKnockout(table, stats, opt, rec);
  }
  return summarize(rec);
}


// 单场分析（泊松 + Dixon-Coles）：90 分钟胜平负、含点球胜率、最可能比分
function singleMatchAnalysis(eloA, eloB) {
  const d = eloA - eloB;
  const E = eloExpect(d);
  const [ma, mb] = goalMeans(d);
  const P = (l, k) => Math.exp(-l) * Math.pow(l, k) / FACT[k];
  let win = 0, draw = 0, loss = 0;
  const scores = [];
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    let p = P(ma, i) * P(mb, j);
    if (i === 0 && j === 0) p *= 1 - ma * mb * DC_RHO;
    else if (i === 1 && j === 0) p *= 1 + mb * DC_RHO;
    else if (i === 0 && j === 1) p *= 1 + ma * DC_RHO;
    else if (i === 1 && j === 1) p *= 1 - DC_RHO;
    if (i > j) win += p; else if (i === j) draw += p; else loss += p;
    scores.push([p, i, j]);
  }
  const total = win + draw + loss;
  scores.sort((x, y) => y[0] - x[0]);
  const r1 = (x) => Math.round((x / total) * 1000) / 10;
  return {
    winPen: Math.round(((win + draw * (0.5 + (E - 0.5) * PENALTY_COMPRESS)) / total) * 100),
    wdl: [r1(win), r1(draw), r1(loss)],
    topScores: scores.slice(0, 3).map(([p, i, j]) => ({ score: `${i}:${j}`, p: r1(p) })),
  };
}
function singleMatchWin(eloA, eloB) {
  return singleMatchAnalysis(eloA, eloB).winPen;
}

function pub(t) {
  return { zh: t.zh, en: t.en, es: t.es, yue: t.yue, flag: t.flag };
}

function summarize(rec) {
  const pct = (x) => Math.round((x / SIMS) * 1000) / 10;

  // 16 强遇 Top8：从 r16 相遇矩阵汇总
  const collisionR16 = new Float64Array(N);
  for (let i = 0; i < N; i++)
    for (const t8 of TOP8) if (t8 !== i) collisionR16[i] += rec.meet.r16[i][t8];

  const out = teams.map((t) => {
    const oppElo = rec.oppEloN[t.id] ? rec.oppEloSum[t.id] / rec.oppEloN[t.id] : 0;
    const likely = [...rec.r32opp[t.id].keys()]
      .map((j) => ({ j, c: rec.r32opp[t.id][j] }))
      .filter((x) => x.c > 0)
      .sort((a, b) => b.c - a.c)
      .slice(0, 3)
      .map((x) => ({ ...pub(teams[x.j]), p: pct(x.c) }));
    return {
      zh: t.zh, en: t.en, es: t.es, yue: t.yue, flag: t.flag, group: t.group,
      elo: t.elo, eloLive: t.eloLive, eloDelta: t.eloLive - t.elo,
      eloRank: t.eloRank, fifaRank: t.fifaRank, host: !!t.host,
      p32: pct(rec.p32[t.id]), p16: pct(rec.p16[t.id]), p8: pct(rec.p8[t.id]),
      p4: pct(rec.p4[t.id]), pFinal: pct(rec.pF[t.id]), pChampion: pct(rec.pC[t.id]),
      g1: pct(rec.g1[t.id]), g2: pct(rec.g2[t.id]), g3: pct(rec.g3[t.id]),
      upsetChance: pct(rec.upsetWins[t.id]),
      collision: pct(rec.collision[t.id] + collisionR16[t.id]),
      avgR32OppElo: Math.round(oppElo),
      likelyOpponents: likely,
    };
  });

  // 路径标签：在 Elo 前 16 的队里比较 32 强对手池强度
  const top16 = [...out].sort((a, b) => b.p16 - a.p16).slice(0, 16);
  const oppElos = top16.map((t) => t.avgR32OppElo).sort((a, b) => a - b);
  const q1 = oppElos[Math.floor(oppElos.length * 0.25)];
  const q3 = oppElos[Math.floor(oppElos.length * 0.75)];
  const top16Set = new Set(top16.map((t) => t.en));
  for (const t of out) {
    t.pathLabel = !top16Set.has(t.en)
      ? "路径中性"
      : t.avgR32OppElo <= q1 ? "路径优势" : t.avgR32OppElo >= q3 ? "路径压力" : "路径中性";
    t.pathCode = t.pathLabel === "路径优势" ? "adv" : t.pathLabel === "路径压力" ? "press" : "mid";
  }

  // 相遇矩阵（按 p16 取前 16 队）
  const matrixTeams = top16.map((t) => t.en);
  const idOf = (en) => byEn.get(en).id;
  const matrices = {};
  for (const s of ["r32", "r16", "r8", "r4"]) {
    matrices[s] = matrixTeams.map((a) =>
      matrixTeams.map((b) => (a === b ? null : pct(rec.meet[s][idOf(a)][idOf(b)])))
    );
  }

  // 强强预警：Elo 前 12 两两在 32/16 强相遇概率
  const top12 = eloRankOrder.slice(0, 12);
  const watch = [];
  for (let i = 0; i < top12.length; i++)
    for (let j = i + 1; j < top12.length; j++) {
      const a = top12[i].id, b = top12[j].id;
      const pr32 = pct(rec.meet.r32[a][b]), pr16 = pct(rec.meet.r16[a][b]);
      if (pr32 + pr16 >= 5)
        watch.push({
          a: pub(teams[a]), b: pub(teams[b]),
          r32: pr32, r16: pr16, total: Math.round((pr32 + pr16) * 10) / 10,
        });
    }
  watch.sort((x, y) => y.total - x.total);

  // 爆冷雷达：Elo 16 名以外按进 8 强概率排序
  const upsets = out
    .filter((t) => t.eloRank > 16)
    .sort((a, b) => b.p8 - a.p8)
    .slice(0, 6)
    .map((t) => ({ zh: t.zh, flag: t.flag, group: t.group, p16: t.p16, p8: t.p8, eloRank: t.eloRank }));

  // 小组强度
  const groupInfo = groupNames.map((g) => {
    const ids = [...groups[g]];
    const elos = ids.map((i) => teams[i].eloLive);
    const avg = elos.reduce((a, b) => a + b) / 4;
    const spread = Math.max(...elos) - Math.min(...elos);
    return { group: g, avgElo: Math.round(avg), spread: Math.round(spread), teams: ids.map((i) => pub(teams[i])) };
  });

  // 小组标签并入每队 + 模板文案（可被 data/teams.json 的 note 字段覆盖）
  const maxAvg = Math.max(...groupInfo.map((g) => g.avgElo));
  const giMap = Object.fromEntries(groupInfo.map((g) => [g.group, g]));
  for (const g of groupInfo) {
    g.strength = Math.max(0, Math.min(100, Math.round((g.avgElo - 1300) / 6.7)));
    g.closeness = Math.max(0, Math.min(100, Math.round(100 - (g.spread - 160) / 6)));
    g.label = g.avgElo === maxAvg ? "死亡组" : g.avgElo >= 1800 ? "强组" : g.spread <= 200 ? "胶着组" : "常规组";
  }
  for (const t of out) {
    const gi = giMap[t.group];
    t.groupStrength = gi.strength; t.groupCloseness = gi.closeness; t.groupLabel = gi.label;
    const posTxt = t.g1 >= t.g2 ? `小组第一概率 ${t.g1}%` : `更可能以小组第二出线（${t.g2}%）`;
    const oppTxt = t.avgR32OppElo ? `32 强对手池平均 Elo ${t.avgR32OppElo}` : "32 强对手池待定";
    t.reason = `Elo ${t.eloLive}${t.eloDelta ? `（开赛以来 ${t.eloDelta > 0 ? "+" : ""}${t.eloDelta}）` : ""}（第 ${t.eloRank}），${posTxt}，${oppTxt}，强强风险 ${t.collision}%。`;
    t.detail = t.pathLabel === "路径优势"
      ? `${posTxt}；潜在首轮对手偏弱（${oppTxt}），提前撞上 Top 8 的概率只有 ${t.collision}%。`
      : t.pathLabel === "路径压力"
      ? `${oppTxt}，提前遭遇 Top 8 的概率达 ${t.collision}%；实力优势会被路线部分抵消。`
      : `${posTxt}；对手池强度中等（${oppTxt}），路线不构成额外加分或减分。`;
    t.upsetReason = t.eloRank <= 10
      ? `作为强队，爆冷价值有限：淘汰赛击败 Elo 更高对手的机会本就稀少（${t.upsetChance}%）。`
      : `一万次模拟中，有 ${t.upsetChance}% 的概率在 32/16 强淘汰 Elo 更高的对手；小组属于${t.groupLabel}。`;
    t.realStatus = `2026 ${t.group} 组：${gi.teams.join("、")}`;
  }

  // 强强对位卡：watch 前 4 名补上单场预测
  const zhMap = Object.fromEntries(teams.map((tt) => [tt.zh, tt]));
  const matchups = watch.slice(0, 4).map((w) => {
    const A = zhMap[w.a.zh], B = zhMap[w.b.zh];
    const ana = singleMatchAnalysis(A.eloLive, B.eloLive);
    const winA = ana.winPen;
    const stronger = winA >= 50 ? w.a : w.b;
    return {
      ...w,
      winA, winB: 100 - winA,
      wdl: ana.wdl,
      topScores: ana.topScores,
      winner: stronger,
      eloDiff: A.eloLive - B.eloLive,
      factorData: (() => {
        const [la, lb] = goalMeans(A.eloLive - B.eloLive);
        return { xgA: Math.round(la * 100) / 100, xgB: Math.round(lb * 100) / 100,
                 dA: A.eloLive - A.elo, dB: B.eloLive - B.elo,
                 baseA: A.elo, baseB: B.elo, played: playedCount };
      })(),
    };
  });

  // 最可能对阵图：每场淘汰赛的模态对阵 + 模态胜者
  const bracket = koMatches.map((m) => {
    const pairs = rec.modal.get(m.num);
    let bestKey = null, bestC = 0;
    for (const [k, c] of pairs) if (c > bestC) { bestC = c; bestKey = k; }
    const [a, b] = bestKey.split("-").map(Number);
    const wins = rec.modalWin.get(m.num);
    let w = null, wc = 0;
    for (const [k, c] of wins) if (c > wc) { wc = c; w = k; }
    return {
      num: m.num, round: m.round,
      a: pub(teams[a]), b: pub(teams[b]),
      pairP: pct(bestC),
      winner: pub(teams[w]),
      half: m.num === 104 ? "final" : upperHalf.has(m.num) ? "upper" : "lower",
    };
  });

  // 洞察
  const byP16 = [...out].sort((a, b) => b.p16 - a.p16);
  const topTeams = byP16.slice(0, 12);
  const drop = [...topTeams].sort((a, b) => (b.p32 - b.p16) - (a.p32 - a.p16))[0];
  const colKing = [...topTeams].sort((a, b) => b.collision - a.collision)[0];
  const death = [...groupInfo].sort((a, b) => b.avgElo - a.avgElo)[0];
  const champ = [...out].sort((a, b) => b.pChampion - a.pChampion)[0];

  return {
    teams: out, matrixTeams: top16.map((t) => ({ zh: t.zh, en: t.en, es: t.es, yue: t.yue, flag: t.flag })),
    matrices, watch: watch.slice(0, 8), matchups, upsets, groupInfo, bracket,
    insights: {
      safest: { zh: byP16[0].zh, en: byP16[0].en, es: byP16[0].es, yue: byP16[0].yue, flag: byP16[0].flag, p16: byP16[0].p16 },
      biggestDrop: { zh: drop.zh, en: drop.en, es: drop.es, yue: drop.yue, flag: drop.flag, gap: Math.round((drop.p32 - drop.p16) * 10) / 10 },
      collisionKing: { zh: colKing.zh, en: colKing.en, es: colKing.es, yue: colKing.yue, flag: colKing.flag, p: colKing.collision },
      deathGroup: { group: death.group, avgElo: death.avgElo, teams: death.teams },
      champion: { zh: champ.zh, en: champ.en, es: champ.es, yue: champ.yue, flag: champ.flag, p: champ.pChampion },
    },
  };
}

// ---------- 输出 ----------
const playedCount = groupMatches.filter((m) => m.score?.ft).length;
const result = {
  generatedAt: new Date().toISOString(),
  model: {
    sims: SIMS,
    eloSnapshot: teamData.eloSnapshot,
    playedMatches: playedCount,
    params: {
      baseGoals: 1.3, goalScale: GOAL_SCALE, dcRho: DC_RHO,
      hostBonus: HOST_BONUS, altitudeBonus: ALTITUDE_BONUS,
      weatherAdj: 15, penaltyCompress: PENALTY_COMPRESS, eloK: ELO_K,
    },
    note: playedCount === 0
      ? "小组赛尚未开打，全部 104 场为模拟结果。"
      : `已计入 ${playedCount} 场真实比分并据此动态更新 Elo，其余场次为模拟结果。`,
  },
  scenarios: {
    base: runScenario({ host: false, weather: false }),
    w: runScenario({ host: false, weather: true }),
    h: runScenario({ host: true, weather: false }),
    wh: runScenario({ host: true, weather: true }),
  },
};

writeFileSync(join(root, "data.json"), JSON.stringify(result));
console.log(`✓ data.json 已生成（${SIMS} 次模拟 × 4 场景，已计入真实比分 ${playedCount} 场）`);
