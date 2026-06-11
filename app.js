/* Knockout Radar V13 · 三语前端（zh / en / es）
   唯一数据源：data.json（结构化、语言无关）；全部文案由本文件按语言渲染。
   Buy Me a Coffee 链接：改下方 BMC_URL 一处即可。 */

const BMC_URL = "https://buymeacoffee.com/yourname"; // TODO: 换成你的 BMC 用户名

let DATA = null;
const state = { stage: "p16", matrix: "r32", weather: true, host: true, lang: "zh" };

const $ = (s) => document.querySelector(s);
const LOCALE = { zh: "zh-CN", en: "en-US", es: "es-ES", yue: "zh-HK" };
const nm = (t) => t[state.lang] || t.en || t.zh;
const fmt = (n) => n.toLocaleString(LOCALE[state.lang]);

/* ============================ 文案字典 ============================ */
const T = {
  zh: {
    eyebrow: "World Cup Prediction Lab · 美 加 墨 · 48 队 104 场",
    title: "2026 世界杯淘汰赛路线预测",
    pillSim: (s, d) => `Fable 5 真实数据 · ${s} 次模拟计算 · ${d} 更新`,
    pillReal: (n, s, d) => `Fable 5 真实比分 ${n} 场 · ${s} 次模拟计算 · ${d} 更新`,
    chipW: "计入天气适应", chipH: "计入主场优势", bmc: "请我喝咖啡",
    bento: {
      heatT: "相遇概率热力图", heatS: "点开任意格子，看两队在两万次模拟中相遇了多少次",
      probT: "淘汰赛概率", probS: "32 / 16 / 8 / 4 强与夺冠概率榜",
      warnT: "强强预警", warnS: (r, p, s, c) => `${r}相遇概率 ${p}% · ${s} 次模拟相遇 ${c} 次`,
      pathT: "路径优势", pathS: "签运最好的强队与最可能的爆冷者",
    },
    stagesTab: { p32: "32 强", p16: "16 强", p8: "8 强", p4: "4 强", pChampion: "夺冠" },
    stages: { p32: "进 32 强", p16: "进 16 强", p8: "进 8 强", p4: "进 4 强", pChampion: "夺冠" },
    rounds: { r32: "32 强", r16: "16 强", r8: "8 强", r4: "半决赛" },
    probTitle: (st) => `${st}概率榜`,
    th: { team: "球队", collision: "撞车风险", path: "路径判断" },
    host: "东道主", group: (g) => `${g} 组`, oppPool: "对手池 Elo",
    pathLabels: { adv: "路径优势", press: "路径压力", mid: "路径中性" },
    fnote: "撞车风险 = 在 32 / 16 强阶段遇到 Elo 前八球队的概率；路径判断比较 32 强潜在对手池的平均强度（仅在 16 强概率前 16 的球队中评定）。",
    heatTitle: "16 队相遇概率",
    heatIdle: (st, s) => `颜色越深，两队在${st}相遇概率越高。点按任意格子，查看两队在 ${s} 次模拟中实际相遇了多少次。`,
    heatPick: (s, a, b, st, c, p) =>
      `经过 <strong class="num">${s}</strong> 次模拟，<strong>${a}</strong> 与 <strong>${b}</strong> 在${st}相遇了 <strong class="num">${c}</strong> 次 —— 相遇概率 <span class="num">${p}%</span>。`,
    watchTitle: (pair) => `${pair}，以及其他三组`,
    watchLede: "12 组 × 最佳第三名的新赛制下，强队提前碰面是最值得盯的结构性风险。以下是 Elo 前 12 两两组合中，最可能在淘汰赛前两轮相遇的对阵。",
    watchMeet: (s, c) => `${s} 次模拟相遇 ${c} 次`,
    watchSplit: (r, p32, p16, d) => `最可能在${r}碰面 · 32 强 <span class="num">${p32}%</span> · 16 强 <span class="num">${p16}%</span> · 实力差 <span class="num">${d > 0 ? "+" : ""}${d} Elo</span>`,
    win: (n) => `${n}胜`, draw: "平",
    watchNote: (w, a, b, scores) => `含点球的晋级预测：<strong>${w}</strong> <span class="num">${a}% : ${b}%</span>${scores ? `；最可能比分 ${scores}` : ""}。`,
    factors: {
      f1: "攻防匹配", f1v: (a, b) => `期望进球 ${a} : ${b}`, f1n: "权重 60% · 泊松攻防模型",
      f2: "近期状态", f2wait: "待开赛 · 随真实赛果更新", f2v: (an, da, bn, db) => `${an} ${da > 0 ? "+" : ""}${da} / ${bn} ${db > 0 ? "+" : ""}${db}`, f2n: "权重 30% · 赛中 Elo 动态",
      f3: "长期实力", f3v: (a, b) => `Elo ${a} vs ${b}`, f3n: "权重 10% · 赛前快照基线",
    },
    pathTitle: "路径优势", pathLede: "强队中 32 强对手池最友好的几支——实力之外，签运也在帮忙。",
    upsetTitle: "爆冷雷达", upsetLede: "两万次模拟中，最常在淘汰赛掀翻 Elo 更高对手的球队。",
    pathMeta: (e, p) => `对手池 Elo <span class="num good">${e}</span> · 进 8 强 <span class="num">${p}%</span>`,
    upsetMeta: (u, p) => `掀翻上位概率 <span class="num good">${u}%</span> · 进 8 强 <span class="num">${p}%</span>`,
    eloRank: (n) => `Elo 第 ${n}`,
    bracketTitle: "最可能对阵图",
    bracketLede: "每场淘汰赛取两万次模拟中出现频率最高的对阵与胜者——这是「最可能的一种未来」，不是唯一的未来。",
    upper: "上半区", lower: "下半区", cols: ["32 强", "16 强", "1/4 决赛 + 半决赛"],
    pairP: (p) => `对阵出现率 ${p}%`,
    finalLabel: "FINAL · 7.19 · 纽约",
    finalLine: (a, b, s, c, w) => `最可能决赛：<strong>${a}</strong> 对 <strong>${b}</strong>（${s} 次模拟中出现 ${c} 次），最可能捧杯：<strong class="fl-champ">${w}</strong>`,
    coloH: "模型与数据说明",
    coloP1: (s, note) => `分组、赛程与淘汰赛对阵树为 2026 真实数据（openfootball，开赛后含真实比分）；全部概率来自 Fable 5 的 ${s} 次 Elo 蒙特卡洛模拟，并非官方概率。${note}`,
    note0: "小组赛尚未开打，全部 104 场为模拟结果。",
    noteN: (n) => `已计入 ${n} 场真实比分并据此动态更新 Elo，其余场次为模拟结果。`,
    coloP2: "单场结果由泊松进球模型生成（Dixon-Coles 低比分修正，缩放常数经数值标定贴合 Elo 期望）；东道主按 16 个场地逐场判定主场加成，墨西哥城含海拔修正；开赛后每场真实赛果按世界杯口径（K=60）动态更新 Elo。这是概率模型，不是预言，也不构成任何投注建议。",
    dock: { heat: "热力图", prob: "概率榜", warn: "预警", path: "路径" },
    ins: {
      safest: (st) => `最稳${st}`, safestN: (st) => `全部球队中${st}概率最高`,
      shaky: "出线最悬的种子", shakyN: "Elo 前 12 中进 32 强概率最低",
      drop: "最大落差", dropN: (prev, cur) => `${prev}到${cur}之间概率跌幅最大`,
      col: "撞车之王", colN: "32 / 16 强提前遇到 Top 8 的概率",
      champ: "最可能冠军", champN: (s) => `${s} 次模拟中的夺冠频率`,
    },
    briefSame: (f, n, p, cp) => `当前模拟里，<strong>${f} ${n}</strong>夺冠概率最高（<span class="num up">${p}%</span>），但它同时也是撞车之王——提前遭遇 Top 8 的概率达 <span class="num down">${cp}%</span>，实力最强，路线也最硬。`,
    briefDiff: (f, n, p, cf, cn, cp) => `当前模拟里，<strong>${f} ${n}</strong>夺冠概率最高（<span class="num up">${p}%</span>），而撞车之王是<strong>${cf} ${cn}</strong>——提前遭遇 Top 8 的概率达 <span class="num down">${cp}%</span>。`,
    briefTail: (g, teams, sf, sn, sp) => `死亡之组是 <strong>${g} 组</strong>（${teams}），最稳进 16 强的是<strong>${sf} ${sn}</strong>（<span class="num up">${sp}%</span>）。`,
    listJoin: "、",
    weightsH: "模型因子与权重",
    weights: (p) => [
      ["长期实力", "基线", `赛前 Elo 快照（World Football Elo 口径），所有计算的起点`],
      ["近期状态", `K = ${p.eloK}`, "开赛后每场真实赛果按净胜球倍率动态更新 Elo，随赛事推进权重持续上升"],
      ["攻防转换", `λ = ${p.baseGoals} × e^(ΔElo/${p.goalScale})`, `泊松期望进球模型，Dixon-Coles 低比分修正 ρ = ${p.dcRho}，单场胜平负与比分分布的主要来源`],
      ["主场优势", `+${p.hostBonus} Elo`, "按 16 个场地逐场判定，仅东道主在本国场地生效（可在顶部开关关闭）"],
      ["海拔修正", `+${p.altitudeBonus} Elo`, "墨西哥城阿兹特克球场（海拔 2,240 米）额外加成"],
      ["天气适应", `±${p.weatherAdj} Elo`, "按球队气候适应能力逐队标定（可在顶部开关关闭）"],
      ["点球修正", `压缩系数 ${p.penaltyCompress}`, "点球大战向 50:50 压缩：胜率 = 0.5 + (期望 − 0.5) × 系数"],
      ["赛制结构", "真实对阵树", "12 组 × 最佳第三名的真实落位规则与官方淘汰赛对阵树（openfootball）"],
    ],
    weightsExcl: "未纳入的因素：阵型与战术风格、压迫强度、教练经验、伤病与阵容轮换、红黄牌停赛。这些缺少可靠的结构化数据源，与其拍脑袋给权重，不如明确告知边界——解读概率时请把它们作为模型之外的修正项。",
  },

  en: {
    eyebrow: "World Cup Prediction Lab · USA CAN MEX · 48 teams, 104 matches",
    title: "2026 World Cup Knockout Path Predictor",
    pillSim: (s, d) => `Fable 5 real data · ${s} simulations · updated ${d}`,
    pillReal: (n, s, d) => `Fable 5 · ${n} real results · ${s} simulations · updated ${d}`,
    chipW: "Weather adaptation", chipH: "Host advantage", bmc: "Buy me a coffee",
    bento: {
      heatT: "Meeting Heatmap", heatS: "Tap any cell to see how often two teams met across 20,000 simulations",
      probT: "Knockout Odds", probS: "R32 / R16 / QF / SF and title odds",
      warnT: "Collision Watch", warnS: (r, p, s, c) => `${p}% chance to meet in the ${r} · met ${c} times in ${s} runs`,
      pathT: "Path Advantage", pathS: "Luckiest draws among favorites, plus the likeliest giant-killers",
    },
    stagesTab: { p32: "R32", p16: "R16", p8: "QF", p4: "SF", pChampion: "Title" },
    stages: { p32: "Reach R32", p16: "Reach R16", p8: "Reach QF", p4: "Reach SF", pChampion: "Win the title" },
    rounds: { r32: "Round of 32", r16: "Round of 16", r8: "quarter-finals", r4: "semi-finals" },
    probTitle: (st) => `${st} — odds board`,
    th: { team: "Team", collision: "Collision risk", path: "Path read" },
    host: "Host", group: (g) => `Group ${g}`, oppPool: "Opp. pool Elo",
    pathLabels: { adv: "Friendly path", press: "Hard path", mid: "Neutral path" },
    fnote: "Collision risk = probability of meeting a top-8 Elo side in the R32/R16. Path read compares the average strength of the potential R32 opponent pool (rated among the top 16 by R16 odds only).",
    heatTitle: "Meeting odds — top 16",
    heatIdle: (st, s) => `Darker means a higher chance the two teams meet in the ${st}. Tap any cell to see how many times they actually met across ${s} simulations.`,
    heatPick: (s, a, b, st, c, p) =>
      `Across <strong class="num">${s}</strong> simulations, <strong>${a}</strong> and <strong>${b}</strong> met in the ${st} <strong class="num">${c}</strong> times — a <span class="num">${p}%</span> chance.`,
    watchTitle: (pair) => `${pair}, plus three more`,
    watchLede: "Under the new 12-group + best-thirds format, early heavyweight collisions are the structural risk to watch. These are the most likely first-two-round meetings among the Elo top 12.",
    watchMeet: (s, c) => `met ${c} times in ${s} runs`,
    watchSplit: (r, p32, p16, d) => `Most likely in the ${r} · R32 <span class="num">${p32}%</span> · R16 <span class="num">${p16}%</span> · gap <span class="num">${d > 0 ? "+" : ""}${d} Elo</span>`,
    win: (n) => `${n} win`, draw: "Draw",
    watchNote: (w, a, b, scores) => `Advance prediction incl. penalties: <strong>${w}</strong> <span class="num">${a}% : ${b}%</span>${scores ? `; most likely scores ${scores}` : ""}.`,
    factors: {
      f1: "Attack vs defense", f1v: (a, b) => `xG ${a} : ${b}`, f1n: "Weight 60% · Poisson model",
      f2: "Recent form", f2wait: "Awaiting kickoff · updates with real results", f2v: (an, da, bn, db) => `${an} ${da > 0 ? "+" : ""}${da} / ${bn} ${db > 0 ? "+" : ""}${db}`, f2n: "Weight 30% · in-tournament Elo",
      f3: "Long-term strength", f3v: (a, b) => `Elo ${a} vs ${b}`, f3n: "Weight 10% · pre-tournament baseline",
    },
    pathTitle: "Path Advantage", pathLede: "Favorites with the friendliest R32 opponent pools — the draw is doing them favors.",
    upsetTitle: "Upset Radar", upsetLede: "The teams that most often topple higher-Elo opponents across 20,000 simulations.",
    pathMeta: (e, p) => `Opp. pool Elo <span class="num good">${e}</span> · QF <span class="num">${p}%</span>`,
    upsetMeta: (u, p) => `Upset rate <span class="num good">${u}%</span> · QF <span class="num">${p}%</span>`,
    eloRank: (n) => `Elo #${n}`,
    bracketTitle: "Most Likely Bracket",
    bracketLede: "Each tie shows the most frequent pairing and winner across 20,000 simulations — the single most likely future, not the only one.",
    upper: "Upper half", lower: "Lower half", cols: ["Round of 32", "Round of 16", "QF + SF"],
    pairP: (p) => `pairing rate ${p}%`,
    finalLabel: "FINAL · JUL 19 · NEW YORK",
    finalLine: (a, b, s, c, w) => `Most likely final: <strong>${a}</strong> vs <strong>${b}</strong> (appeared ${c} times in ${s} runs). Most likely champion: <strong class="fl-champ">${w}</strong>`,
    coloH: "Model & data notes",
    coloP1: (s, note) => `Groups, fixtures and the bracket tree are real 2026 data (openfootball; real scores flow in once play begins). All probabilities come from Fable 5's ${s} Elo Monte Carlo simulations — they are not official odds. ${note}`,
    note0: "Group stage hasn't started; all 104 matches are simulated.",
    noteN: (n) => `${n} real results are locked in and drive live Elo updates; remaining matches are simulated.`,
    coloP2: "Match outcomes use a Poisson goal model (Dixon-Coles low-score correction, scale calibrated to Elo expectation). Host advantage is applied venue-by-venue across all 16 stadiums, with an altitude bonus in Mexico City. After kickoff, every real result updates Elo at World Cup weighting (K=60). This is a probability model, not a prophecy, and not betting advice.",
    dock: { heat: "Heatmap", prob: "Odds", warn: "Watch", path: "Paths" },
    ins: {
      safest: (st) => `Safest: ${st}`, safestN: (st) => `Highest odds to ${st.toLowerCase()}`,
      shaky: "Shakiest seed", shakyN: "Lowest R32 odds among Elo top 12",
      drop: "Biggest drop-off", dropN: (prev, cur) => `Largest odds drop from ${prev} to ${cur}`,
      col: "Collision king", colN: "Odds of meeting a top-8 side in R32/R16",
      champ: "Most likely champion", champN: (s) => `Title frequency across ${s} runs`,
    },
    briefSame: (f, n, p, cp) => `In the current simulation, <strong>${f} ${n}</strong> leads the title race (<span class="num up">${p}%</span>) — and is also the collision king, with a <span class="num down">${cp}%</span> chance of meeting a top-8 side early. Strongest squad, hardest road.`,
    briefDiff: (f, n, p, cf, cn, cp) => `In the current simulation, <strong>${f} ${n}</strong> leads the title race (<span class="num up">${p}%</span>), while the collision king is <strong>${cf} ${cn}</strong> — a <span class="num down">${cp}%</span> chance of meeting a top-8 side early.`,
    briefTail: (g, teams, sf, sn, sp) => `The group of death is <strong>Group ${g}</strong> (${teams}); the safest bet to reach the R16 is <strong>${sf} ${sn}</strong> (<span class="num up">${sp}%</span>).`,
    listJoin: ", ",
    weightsH: "Model factors & weights",
    weights: (p) => [
      ["Long-term strength", "baseline", "Pre-tournament Elo snapshot (World Football Elo) — the starting point of every calculation"],
      ["Recent form", `K = ${p.eloK}`, "Every real result updates Elo with a goal-margin multiplier; its influence grows as the tournament progresses"],
      ["Attack-defense exchange", `λ = ${p.baseGoals} × e^(ΔElo/${p.goalScale})`, `Poisson expected-goals model with Dixon-Coles correction ρ = ${p.dcRho}; the main source of W/D/L and scoreline distributions`],
      ["Host advantage", `+${p.hostBonus} Elo`, "Judged venue-by-venue across 16 stadiums; applies only to hosts on home soil (toggle in the header)"],
      ["Altitude bonus", `+${p.altitudeBonus} Elo`, "Extra bump at Mexico City's Estadio Azteca (2,240 m)"],
      ["Weather adaptation", `±${p.weatherAdj} Elo`, "Calibrated per team for climate adaptability (toggle in the header)"],
      ["Penalty correction", `compress ${p.penaltyCompress}`, "Shootouts compress toward 50:50 — win prob = 0.5 + (expectation − 0.5) × factor"],
      ["Format structure", "real bracket", "Real third-place allocation rules and the official knockout tree (openfootball)"],
    ],
    weightsExcl: "Not included: formation & tactical style, pressing intensity, coach experience, injuries & rotation, suspensions. No reliable structured data source exists for these — rather than inventing weights, we state the boundary. Treat them as adjustments outside the model when reading the odds.",
  },

  es: {
    eyebrow: "World Cup Prediction Lab · EE. UU. CAN MÉX · 48 equipos, 104 partidos",
    title: "Predicción de Rutas Eliminatorias · Mundial 2026",
    pillSim: (s, d) => `Fable 5 datos reales · ${s} simulaciones · act. ${d}`,
    pillReal: (n, s, d) => `Fable 5 · ${n} resultados reales · ${s} simulaciones · act. ${d}`,
    chipW: "Adaptación climática", chipH: "Ventaja de local", bmc: "Invítame un café",
    bento: {
      heatT: "Mapa de Cruces", heatS: "Toca una celda para ver cuántas veces se cruzaron en 20.000 simulaciones",
      probT: "Probabilidades", probS: "Tablas de 16avos / octavos / cuartos / semis y campeón",
      warnT: "Alerta de Choques", warnS: (r, p, s, c) => `${p}% de cruce en ${r} · ${c} cruces en ${s} simulaciones`,
      pathT: "Ventaja de Ruta", pathS: "Los favoritos con mejor sorteo y los aspirantes a la sorpresa",
    },
    stagesTab: { p32: "1/16", p16: "Octavos", p8: "Cuartos", p4: "Semis", pChampion: "Campeón" },
    stages: { p32: "Llegar a 16avos", p16: "Llegar a octavos", p8: "Llegar a cuartos", p4: "Llegar a semis", pChampion: "Ser campeón" },
    rounds: { r32: "16avos", r16: "octavos", r8: "cuartos", r4: "semifinales" },
    probTitle: (st) => `${st} — tabla de probabilidades`,
    th: { team: "Equipo", collision: "Riesgo de choque", path: "Lectura de ruta" },
    host: "Anfitrión", group: (g) => `Grupo ${g}`, oppPool: "Elo del bombo rival",
    pathLabels: { adv: "Ruta favorable", press: "Ruta dura", mid: "Ruta neutral" },
    fnote: "Riesgo de choque = probabilidad de enfrentar a un top-8 de Elo en 16avos/octavos. La lectura de ruta compara la fuerza media del bombo rival de 16avos (solo entre los 16 mejores por probabilidad de octavos).",
    heatTitle: "Probabilidad de cruce — top 16",
    heatIdle: (st, s) => `Cuanto más oscuro, mayor probabilidad de cruce en ${st}. Toca una celda para ver cuántas veces se cruzaron en ${s} simulaciones.`,
    heatPick: (s, a, b, st, c, p) =>
      `En <strong class="num">${s}</strong> simulaciones, <strong>${a}</strong> y <strong>${b}</strong> se cruzaron en ${st} <strong class="num">${c}</strong> veces — probabilidad del <span class="num">${p}%</span>.`,
    watchTitle: (pair) => `${pair}, y tres duelos más`,
    watchLede: "Con el nuevo formato de 12 grupos + mejores terceros, los choques tempranos entre gigantes son el riesgo estructural a vigilar. Estos son los cruces más probables del top 12 de Elo en las dos primeras rondas.",
    watchMeet: (s, c) => `${c} cruces en ${s} simulaciones`,
    watchSplit: (r, p32, p16, d) => `Más probable en ${r} · 16avos <span class="num">${p32}%</span> · octavos <span class="num">${p16}%</span> · brecha <span class="num">${d > 0 ? "+" : ""}${d} Elo</span>`,
    win: (n) => `Gana ${n}`, draw: "Empate",
    watchNote: (w, a, b, scores) => `Pronóstico con penales: <strong>${w}</strong> <span class="num">${a}% : ${b}%</span>${scores ? `; marcadores más probables ${scores}` : ""}.`,
    factors: {
      f1: "Ataque vs defensa", f1v: (a, b) => `xG ${a} : ${b}`, f1n: "Peso 60% · modelo Poisson",
      f2: "Forma reciente", f2wait: "Por comenzar · se actualiza con resultados reales", f2v: (an, da, bn, db) => `${an} ${da > 0 ? "+" : ""}${da} / ${bn} ${db > 0 ? "+" : ""}${db}`, f2n: "Peso 30% · Elo en torneo",
      f3: "Fuerza histórica", f3v: (a, b) => `Elo ${a} vs ${b}`, f3n: "Peso 10% · línea base previa",
    },
    pathTitle: "Ventaja de Ruta", pathLede: "Favoritos con el bombo rival más amable en 16avos: el sorteo también juega.",
    upsetTitle: "Radar de Sorpresas", upsetLede: "Los equipos que más veces tumban a rivales de mayor Elo en 20.000 simulaciones.",
    pathMeta: (e, p) => `Bombo rival <span class="num good">${e}</span> · cuartos <span class="num">${p}%</span>`,
    upsetMeta: (u, p) => `Tasa de sorpresa <span class="num good">${u}%</span> · cuartos <span class="num">${p}%</span>`,
    eloRank: (n) => `Elo n.º ${n}`,
    bracketTitle: "Cuadro Más Probable",
    bracketLede: "Cada llave muestra el cruce y el ganador más frecuentes en 20.000 simulaciones: el futuro más probable, no el único.",
    upper: "Parte alta", lower: "Parte baja", cols: ["16avos", "Octavos", "Cuartos + Semis"],
    pairP: (p) => `frecuencia del cruce ${p}%`,
    finalLabel: "FINAL · 19 JUL · NUEVA YORK",
    finalLine: (a, b, s, c, w) => `Final más probable: <strong>${a}</strong> vs <strong>${b}</strong> (${c} veces en ${s} simulaciones). Campeón más probable: <strong class="fl-champ">${w}</strong>`,
    coloH: "Modelo y datos",
    coloP1: (s, note) => `Grupos, calendario y cuadro son datos reales de 2026 (openfootball; con resultados reales una vez iniciado el torneo). Todas las probabilidades provienen de las ${s} simulaciones Elo Monte Carlo de Fable 5 — no son cifras oficiales. ${note}`,
    note0: "La fase de grupos no ha comenzado; los 104 partidos son simulados.",
    noteN: (n) => `${n} resultados reales ya actualizan el Elo en vivo; el resto se simula.`,
    coloP2: "Cada partido usa un modelo de goles Poisson (corrección Dixon-Coles, escala calibrada a la expectativa Elo). La ventaja de local se aplica estadio por estadio en las 16 sedes, con plus de altitud en Ciudad de México. Tras el inicio, cada resultado real actualiza el Elo con ponderación mundialista (K=60). Es un modelo de probabilidad, no una profecía, y no constituye consejo de apuestas.",
    dock: { heat: "Cruces", prob: "Tablas", warn: "Alertas", path: "Rutas" },
    ins: {
      safest: (st) => `Más seguro: ${st}`, safestN: () => `La probabilidad más alta de todos`,
      shaky: "Cabeza de serie en riesgo", shakyN: "Menor probabilidad de 16avos del top 12",
      drop: "Mayor caída", dropN: (prev, cur) => `Mayor caída de ${prev} a ${cur}`,
      col: "Rey del choque", colN: "Probabilidad de top-8 en 16avos/octavos",
      champ: "Campeón más probable", champN: (s) => `Frecuencia de título en ${s} simulaciones`,
    },
    briefSame: (f, n, p, cp) => `En la simulación actual, <strong>${f} ${n}</strong> lidera la carrera por el título (<span class="num up">${p}%</span>) — y también es el rey del choque: <span class="num down">${cp}%</span> de toparse temprano con un top-8. El más fuerte, por el camino más duro.`,
    briefDiff: (f, n, p, cf, cn, cp) => `En la simulación actual, <strong>${f} ${n}</strong> lidera la carrera por el título (<span class="num up">${p}%</span>); el rey del choque es <strong>${cf} ${cn}</strong>, con <span class="num down">${cp}%</span> de cruce temprano con un top-8.`,
    briefTail: (g, teams, sf, sn, sp) => `El grupo de la muerte es el <strong>Grupo ${g}</strong> (${teams}); el más seguro para octavos es <strong>${sf} ${sn}</strong> (<span class="num up">${sp}%</span>).`,
    listJoin: ", ",
    weightsH: "Factores y pesos del modelo",
    weights: (p) => [
      ["Fuerza histórica", "línea base", "Foto Elo previa al torneo (World Football Elo): el punto de partida de todo cálculo"],
      ["Forma reciente", `K = ${p.eloK}`, "Cada resultado real actualiza el Elo con multiplicador por diferencia de goles; su peso crece con el torneo"],
      ["Transición ataque-defensa", `λ = ${p.baseGoals} × e^(ΔElo/${p.goalScale})`, `Modelo Poisson de goles esperados con corrección Dixon-Coles ρ = ${p.dcRho}; fuente principal de 1X2 y marcadores`],
      ["Ventaja de local", `+${p.hostBonus} Elo`, "Sede por sede en los 16 estadios; solo para anfitriones en su país (interruptor arriba)"],
      ["Plus de altitud", `+${p.altitudeBonus} Elo`, "Extra en el Estadio Azteca de Ciudad de México (2.240 m)"],
      ["Adaptación climática", `±${p.weatherAdj} Elo`, "Calibrada por equipo (interruptor arriba)"],
      ["Corrección de penales", `compresión ${p.penaltyCompress}`, "Las tandas comprimen hacia 50:50 — prob. = 0,5 + (expectativa − 0,5) × factor"],
      ["Estructura del formato", "cuadro real", "Reglas reales de mejores terceros y cuadro oficial (openfootball)"],
    ],
    weightsExcl: "No incluido: formación y estilo táctico, intensidad de presión, experiencia del entrenador, lesiones y rotación, sanciones. No existe fuente estructurada fiable — antes que inventar pesos, declaramos el límite. Trátalos como ajustes fuera del modelo al leer las probabilidades.",
  },
  yue: {
    eyebrow: "World Cup Prediction Lab · 美 加 墨 · 48 隊 104 場",
    title: "2026 世界盃淘汰賽路線預測",
    pillSim: (s, d) => `Fable 5 真實數據 · ${s} 次模擬計算 · ${d} 更新`,
    pillReal: (n, s, d) => `Fable 5 真實賽果 ${n} 場 · ${s} 次模擬計算 · ${d} 更新`,
    chipW: "計埋天氣適應", chipH: "計埋主場優勢", bmc: "請我飲咖啡",
    bento: {
      heatT: "對碰機率熱力圖", heatS: "撳開任何一格，睇下兩隊喺兩萬次模擬入面碰過幾多次",
      probT: "淘汰賽機率", probS: "32 / 16 / 8 / 4 強同奪冠機率榜",
      warnT: "強強對碰預警", warnS: (r, p, s, c) => `${r}對碰機率 ${p}% · ${s} 次模擬碰咗 ${c} 次`,
      pathT: "籤運優勢", pathS: "籤運最好嘅強隊，同埋最有機會爆冷嗰啲",
    },
    stagesTab: { p32: "32 強", p16: "16 強", p8: "8 強", p4: "4 強", pChampion: "奪冠" },
    stages: { p32: "入 32 強", p16: "入 16 強", p8: "入 8 強", p4: "入 4 強", pChampion: "奪冠" },
    rounds: { r32: "32 強", r16: "16 強", r8: "8 強", r4: "準決賽" },
    probTitle: (st) => `${st}機率榜`,
    th: { team: "球隊", collision: "撞車風險", path: "籤運判斷" },
    host: "主辦國", group: (g) => `${g} 組`, oppPool: "對手池 Elo",
    pathLabels: { adv: "籤運好", press: "籤運硬", mid: "籤運中性" },
    fnote: "撞車風險 = 喺 32 / 16 強撞到 Elo 頭八位球隊嘅機率；籤運判斷比較 32 強潛在對手池嘅平均實力（只喺 16 強機率頭 16 位嘅球隊入面評定）。",
    heatTitle: "16 隊對碰機率",
    heatIdle: (st, s) => `顏色越深，兩隊喺${st}對碰機率越高。撳任何一格，睇下兩隊喺 ${s} 次模擬入面真係碰過幾多次。`,
    heatPick: (s, a, b, st, c, p) =>
      `經過 <strong class="num">${s}</strong> 次模擬，<strong>${a}</strong> 同 <strong>${b}</strong> 喺${st}碰咗 <strong class="num">${c}</strong> 次 —— 對碰機率 <span class="num">${p}%</span>。`,
    watchTitle: (pair) => `${pair}，仲有另外三組`,
    watchLede: "12 組 × 最佳第三名嘅新賽制之下，強隊提早對碰係最值得留意嘅結構性風險。以下係 Elo 頭 12 位兩兩組合入面，最有可能喺淘汰賽頭兩輪相遇嘅對碰。",
    watchMeet: (s, c) => `${s} 次模擬碰咗 ${c} 次`,
    watchSplit: (r, p32, p16, d) => `最有可能喺${r}碰面 · 32 強 <span class="num">${p32}%</span> · 16 強 <span class="num">${p16}%</span> · 實力差 <span class="num">${d > 0 ? "+" : ""}${d} Elo</span>`,
    win: (n) => `${n}贏`, draw: "打和",
    watchNote: (w, a, b, scores) => `計埋十二碼嘅晉級預測：<strong>${w}</strong> <span class="num">${a}% : ${b}%</span>${scores ? `；最大機會嘅比數 ${scores}` : ""}。`,
    factors: {
      f1: "攻防匹配", f1v: (a, b) => `預期入球 ${a} : ${b}`, f1n: "權重 60% · 泊松攻防模型",
      f2: "近期狀態", f2wait: "未開波 · 跟住真實賽果更新", f2v: (an, da, bn, db) => `${an} ${da > 0 ? "+" : ""}${da} / ${bn} ${db > 0 ? "+" : ""}${db}`, f2n: "權重 30% · 賽事入面 Elo 變化",
      f3: "長期實力", f3v: (a, b) => `Elo ${a} vs ${b}`, f3n: "權重 10% · 開賽前快照基線",
    },
    pathTitle: "籤運優勢", pathLede: "強隊入面 32 強對手池最好打嘅幾隊——實力以外，籤運都幫緊手。",
    upsetTitle: "爆冷雷達", upsetLede: "兩萬次模擬入面，最常喺淘汰賽爆冷贏高 Elo 對手嘅球隊。",
    pathMeta: (e, p) => `對手池 Elo <span class="num good">${e}</span> · 入 8 強 <span class="num">${p}%</span>`,
    upsetMeta: (u, p) => `爆冷機率 <span class="num good">${u}%</span> · 入 8 強 <span class="num">${p}%</span>`,
    eloRank: (n) => `Elo 第 ${n} 位`,
    bracketTitle: "最大可能對陣圖",
    bracketLede: "每場淘汰賽攞兩萬次模擬入面出現最多嗰個對碰同贏家——呢個係「最有可能嘅一種未來」，唔係唯一嘅未來。",
    upper: "上半區", lower: "下半區", cols: ["32 強", "16 強", "半準決賽 + 準決賽"],
    pairP: (p) => `對碰出現率 ${p}%`,
    finalLabel: "決賽 · 7.19 · 紐約",
    finalLine: (a, b, s, c, w) => `最大可能嘅決賽：<strong>${a}</strong> 對 <strong>${b}</strong>（${s} 次模擬出現咗 ${c} 次），最大機會捧盃：<strong class="fl-champ">${w}</strong>`,
    coloH: "模型同數據說明",
    coloP1: (s, note) => `分組、賽程同淘汰賽對陣樹係 2026 真實數據（openfootball，開賽之後計埋真實賽果）；所有機率嚟自 Fable 5 嘅 ${s} 次 Elo 蒙地卡羅模擬，唔係官方數字。${note}`,
    note0: "分組賽仲未開波，104 場全部係模擬結果。",
    noteN: (n) => `已經計咗 ${n} 場真實賽果並且即時更新 Elo，其餘場次係模擬結果。`,
    coloP2: "每場賽果由泊松入球模型產生（Dixon-Coles 低比數修正，縮放常數經過數值標定貼近 Elo 期望）；主辦國按 16 個場館逐場判定主場加成，墨西哥城計埋海拔修正；開賽之後每場真實賽果按世界盃口徑（K=60）即時更新 Elo。呢個係機率模型，唔係預言，亦唔構成任何投注建議。",
    dock: { heat: "熱力圖", prob: "機率榜", warn: "預警", path: "籤運" },
    ins: {
      safest: (st) => `最穩${st}`, safestN: (st) => `全部球隊入面${st}機率最高`,
      shaky: "出線最牙煙嘅種子", shakyN: "Elo 頭 12 入面入 32 強機率最低",
      drop: "最大跌幅", dropN: (prev, cur) => `${prev}去到${cur}之間機率跌得最勁`,
      col: "撞車之王", colN: "32 / 16 強提早撞到 Top 8 嘅機率",
      champ: "最大機會冠軍", champN: (s) => `${s} 次模擬入面嘅奪冠頻率`,
    },
    briefSame: (f, n, p, cp) => `而家嘅模擬入面，<strong>${f} ${n}</strong>奪冠機率最高（<span class="num up">${p}%</span>），但同時亦係撞車之王——提早撞到 Top 8 嘅機率有 <span class="num down">${cp}%</span>，實力最強，條路亦最難行。`,
    briefDiff: (f, n, p, cf, cn, cp) => `而家嘅模擬入面，<strong>${f} ${n}</strong>奪冠機率最高（<span class="num up">${p}%</span>），而撞車之王係<strong>${cf} ${cn}</strong>——提早撞到 Top 8 嘅機率有 <span class="num down">${cp}%</span>。`,
    briefTail: (g, teams, sf, sn, sp) => `死亡之組係 <strong>${g} 組</strong>（${teams}），最穩入 16 強嘅係<strong>${sf} ${sn}</strong>（<span class="num up">${sp}%</span>）。`,
    listJoin: "、",
    weightsH: "模型因子同權重",
    weights: (p) => [
      ["長期實力", "基線", "開賽前 Elo 快照（World Football Elo 口徑），所有計算嘅起點"],
      ["近期狀態", `K = ${p.eloK}`, "開波之後每場真實賽果按淨勝球倍率即時更新 Elo，越打到後面影響越大"],
      ["攻防轉換", `λ = ${p.baseGoals} × e^(ΔElo/${p.goalScale})`, `泊松預期入球模型，Dixon-Coles 低比數修正 ρ = ${p.dcRho}，單場勝和負同比數分佈嘅主要來源`],
      ["主場優勢", `+${p.hostBonus} Elo`, "按 16 個場館逐場判定，只有主辦國喺自己國家嘅場先生效（頂部開關可以閂）"],
      ["海拔修正", `+${p.altitudeBonus} Elo`, "墨西哥城阿茲特克球場（海拔 2,240 米）額外加成"],
      ["天氣適應", `±${p.weatherAdj} Elo`, "按每隊氣候適應能力逐隊標定（頂部開關可以閂）"],
      ["十二碼修正", `壓縮系數 ${p.penaltyCompress}`, "互射十二碼向 50:50 壓縮：勝率 = 0.5 +（期望 − 0.5）× 系數"],
      ["賽制結構", "真實對陣樹", "12 組 × 最佳第三名嘅真實落位規則同官方淘汰賽對陣樹（openfootball）"],
    ],
    weightsExcl: "未納入嘅因素：陣型同戰術風格、壓迫強度、教練經驗、傷病同輪換、停賽。呢啲冇可靠嘅結構化數據源——與其老作權重，不如講明邊界。睇機率嘅時候，請當佢哋係模型以外嘅修正項。",
  },
};

const L = () => T[state.lang];

/* ============================ 基础 ============================ */
function scenarioKey() {
  if (state.weather && state.host) return "wh";
  if (state.weather) return "w";
  if (state.host) return "h";
  return "base";
}
function S() { return DATA.scenarios[scenarioKey()]; }
function sims() { return DATA.model.sims; }
function meetCount(pct) { return fmt(Math.round((pct / 100) * sims())); }
function modelNote() { return DATA.model.playedMatches > 0 ? L().noteN(DATA.model.playedMatches) : L().note0; }

async function init() {
  detectLang();
  try {
    DATA = window.__DATA__ || (await (await fetch("./data.json", { cache: "no-store" })).json());
  } catch (e) {
    $("#dailyBrief").textContent = "数据加载失败 / Data failed to load — serve over http and keep data.json beside index.html.";
    return;
  }
  bindControls();
  setupDock();
  renderAll();
}

function detectLang() {
  let saved = null;
  try { saved = localStorage.getItem("kr-lang"); } catch (e) {}
  const nav = (navigator.language || "en").toLowerCase();
  state.lang = saved || (nav.startsWith("zh-hk") || nav.startsWith("zh-mo") || nav.startsWith("yue") ? "yue" : nav.startsWith("zh") ? "zh" : nav.startsWith("es") ? "es" : "en");
}

function setLang(lang) {
  state.lang = lang;
  try { localStorage.setItem("kr-lang", lang); } catch (e) {}
  renderAll();
}

function renderAll() {
  document.documentElement.lang = LOCALE[state.lang];
  document.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === state.lang));
  [renderStatic, renderTop, renderBento, renderBrief, renderInsights, renderRanking,
   renderMatrix, renderWatch, renderPath, renderBracket].forEach((fn) => {
    try { fn(); } catch (err) { console.error(`[KR] ${fn.name} 渲染失败:`, err); }
  });
}

/* ---------- 静态文案 ---------- */
function renderStatic() {
  const t = L();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("tEyebrow", t.eyebrow);
  set("tTitle", t.title);
  set("tChipW", t.chipW);
  set("tChipH", t.chipH);
  set("tBmc", t.bmc);
  set("tBmcTop", t.bmc);
  set("tBentoHeatT", t.bento.heatT); set("tBentoHeatS", t.bento.heatS);
  set("tBentoProbT", t.bento.probT); set("tBentoProbS", t.bento.probS);
  set("tBentoWarnT", t.bento.warnT);
  set("tBentoPathT", t.bento.pathT); set("tBentoPathS", t.bento.pathS);
  set("tHeatTitle", t.heatTitle);
  set("tWatchLede", t.watchLede);
  set("tPathTitle", t.pathTitle); set("tPathLede", t.pathLede);
  set("tUpsetTitle", t.upsetTitle); set("tUpsetLede", t.upsetLede);
  set("tBracketTitle", t.bracketTitle); set("tBracketLede", t.bracketLede);
  set("tUpper", t.upper); set("tLower", t.lower);
  set("tColoH", t.coloH); set("tColoP2", t.coloP2);
  set("tFnote", t.fnote);
  document.querySelectorAll("[data-stage]").forEach((b) => (b.textContent = t.stagesTab[b.dataset.stage]));
  document.querySelectorAll("[data-matrix]").forEach((b) => (b.textContent = t.rounds[b.dataset.matrix]));
  document.querySelectorAll(".dock-tab span").forEach((sp) => {
    const key = sp.closest(".dock-tab").dataset.target;
    const map = { heatmap: "heat", probability: "prob", watch: "warn", path: "path" };
    sp.textContent = t.dock[map[key]];
  });
  $("#methodLine").textContent = DATA ? t.coloP1(fmt(sims()), modelNote()) : "";
  set("tWeightsH", t.weightsH);
  set("tWeightsExcl", t.weightsExcl);
  if (DATA && DATA.model.params) {
    $("#weightTable").innerHTML = t.weights(DATA.model.params).map(([f, v, d]) =>
      `<div class="weight-row"><b>${f}</b><span class="wv">${v}</span><small>${d}</small></div>`
    ).join("");
  }
}

/* ---------- 顶部 ---------- */
function renderTop() {
  const d = new Date(DATA.generatedAt);
  const dateText = new Intl.DateTimeFormat(LOCALE[state.lang], {
    timeZone: "Asia/Shanghai", month: "numeric", day: "numeric"
  }).format(d);
  const played = DATA.model.playedMatches;
  $("#modelLine").textContent = played > 0 ? L().pillReal(played, fmt(sims()), dateText) : L().pillSim(fmt(sims()), dateText);
}

/* ---------- Bento ---------- */
function topPicks() {
  const s = S();
  const byP16 = [...s.teams].sort((a, b) => b.p16 - a.p16);
  const m0 = s.matchups[0];
  const pathTop = [...s.teams].filter((t) => t.pathCode === "adv").sort((a, b) => a.avgR32OppElo - b.avgR32OppElo)[0];
  const upsetSorted = [...s.teams].filter((t) => t.eloRank > 10).sort((a, b) => b.upsetChance - a.upsetChance);
  const upsetTop = upsetSorted.find((t) => t.zh !== pathTop.zh) || upsetSorted[0];
  return { top: byP16[0], m0, pathTop, upsetTop };
}

function renderBento() {
  const t = L();
  const { top, m0, pathTop, upsetTop } = topPicks();
  const round = m0.r32 >= m0.r16 ? t.rounds.r32 : t.rounds.r16;
  $("#bentoHeat").textContent = `${m0.a.flag} ${nm(m0.a)} vs ${m0.b.flag} ${nm(m0.b)}`;
  $("#bentoProb").textContent = `${top.flag} ${nm(top)} ${top.p16}%`;
  $("#bentoWarn").textContent = `${m0.a.flag} ${nm(m0.a)} vs ${m0.b.flag} ${nm(m0.b)}`;
  $("#bentoWarnSmall").textContent = t.bento.warnS(round, Math.max(m0.r32, m0.r16), fmt(sims()), meetCount(m0.total));
  $("#bentoPath").textContent = `${pathTop.flag} ${nm(pathTop)} / ${upsetTop.flag} ${nm(upsetTop)}`;
}

/* ---------- 导语 ---------- */
function renderBrief() {
  const t = L();
  const i = S().insights;
  const same = i.champion.zh === i.collisionKing.zh;
  const head = same
    ? t.briefSame(i.champion.flag, nm(i.champion), i.champion.p, i.collisionKing.p)
    : t.briefDiff(i.champion.flag, nm(i.champion), i.champion.p, i.collisionKing.flag, nm(i.collisionKing), i.collisionKing.p);
  const teams = i.deathGroup.teams.map((x) => nm(x)).join(t.listJoin);
  $("#dailyBrief").innerHTML = head + t.briefTail(i.deathGroup.group, teams, i.safest.flag, nm(i.safest), i.safest.p16);
}

/* ---------- 洞察条 ---------- */
const PREV_STAGE = { p16: "p32", p8: "p16", p4: "p8", pChampion: "p4" };

function renderInsights() {
  const t = L();
  const s = S();
  const i = s.insights;
  const stage = state.stage;
  const card = (label, value, note, cls = "") =>
    `<dl class="insight ${cls}"><dt>${label}</dt><dd>${value}</dd><p>${note}</p></dl>`;

  const best = [...s.teams].sort((a, b) => b[stage] - a[stage])[0];
  const c1 = card(t.ins.safest(t.stages[stage]),
    `${best.flag} ${nm(best)} <span class="num" data-count>${best[stage]}%</span>`,
    t.ins.safestN(t.stages[stage]));

  let c2;
  if (stage === "p32") {
    const shaky = [...s.teams].filter((x) => x.eloRank <= 12).sort((a, b) => a.p32 - b.p32)[0];
    c2 = card(t.ins.shaky, `${shaky.flag} ${nm(shaky)} <span class="num" data-count>${shaky.p32}%</span>`, t.ins.shakyN);
  } else {
    const prev = PREV_STAGE[stage];
    const drop = [...s.teams].sort((a, b) => (b[prev] - b[stage]) - (a[prev] - a[stage]))[0];
    const gap = Math.round((drop[prev] - drop[stage]) * 10) / 10;
    c2 = card(t.ins.drop, `${drop.flag} ${nm(drop)} <span class="num" data-count>−${gap}</span>`,
      t.ins.dropN(t.stagesTab[prev], t.stagesTab[stage]));
  }

  const c3 = card(t.ins.col, `${i.collisionKing.flag} ${nm(i.collisionKing)} <span class="num" data-count>${i.collisionKing.p}%</span>`, t.ins.colN);
  const c4 = card(t.ins.champ, `${i.champion.flag} ${nm(i.champion)} <span class="num" data-count>${i.champion.p}%</span>`, t.ins.champN(fmt(sims())));

  $("#insights").innerHTML = c1 + c2 + c3 + c4;
  animateNums($("#insights"));
}

function animateNums(root) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.querySelectorAll("[data-count]").forEach((el) => {
    const text = el.textContent;
    const m = text.match(/-?\d+(\.\d+)?/);
    if (!m) return;
    const target = parseFloat(m[0]);
    const decimals = (m[0].split(".")[1] || "").length;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / 550, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = text.replace(m[0], (target * eased).toFixed(decimals));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ---------- 概率榜 ---------- */
function renderRanking() {
  const t = L();
  const teams = [...S().teams].sort((a, b) => b[state.stage] - a[state.stage]).slice(0, 16);
  $("#probabilityTitle").textContent = t.probTitle(t.stages[state.stage]);

  const header =
    `<div class="rk-row header" role="row">
      <span></span><span>${t.th.team}</span><span>${t.stages[state.stage]}</span>
      <span>${t.th.collision}</span><span class="h-path">${t.th.path}</span>
    </div>`;

  const rows = teams.map((x, idx) => {
    const pathCls = x.pathCode === "adv" ? "good" : x.pathCode === "press" ? "bad" : "mid";
    const colCls = x.collision < 25 ? "low" : "";
    return `<div class="rk-row" role="row">
      <span class="rk-index num">${idx + 1}</span>
      <span class="rk-team">
        <span class="rk-flag">${x.flag}</span>
        <span class="rk-name">${nm(x)}</span>
        <span class="rk-group">${t.group(x.group)}</span>
        ${x.host ? `<span class="rk-host">${t.host}</span>` : ""}
      </span>
      <span class="rk-prob">
        <span class="rk-bar"><i style="width:${x[state.stage]}%"></i></span>
        <span class="rk-val num">${x[state.stage]}%</span>
      </span>
      <span class="rk-collision ${colCls}"><span class="num">${x.collision}%</span></span>
      <span class="rk-path ${pathCls}">${t.pathLabels[x.pathCode]}<br /><span class="sub num">${t.oppPool} ${x.avgR32OppElo}</span></span>
    </div>`;
  });
  $("#ranking").innerHTML = header + rows.join("");
}

/* ---------- 热力图 ---------- */
function heatStyle(v, max) {
  if (v == null || v <= 0) return ["transparent", ""];
  const r = Math.min(1, v / max);
  const a = 0.07 + r * 0.93;
  const cls = r > 0.62 ? "deep" : r < 0.16 ? "faint" : "";
  return [`rgba(247, 201, 72, ${a.toFixed(3)})`, cls];
}

function renderMatrix() {
  const t = L();
  const m = S().matrices[state.matrix];
  const names = S().matrixTeams;
  const max = Math.max(8, ...m.flat().filter((v) => v != null));
  $("#matrixCaption").innerHTML = t.heatIdle(t.rounds[state.matrix], fmt(sims()));

  let html = `<div class="hm-corner"></div>`;
  html += names.map((x, c) => `<div class="hm-col" data-col="${c}" title="${nm(x)}">${x.flag}</div>`).join("");
  m.forEach((row, r) => {
    html += `<div class="hm-rowhead" data-row="${r}"><span>${names[r].flag}</span><span class="hm-name">${nm(names[r])}</span></div>`;
    row.forEach((v, c) => {
      if (r === c) { html += `<button type="button" class="hm-cell empty" disabled>·</button>`; return; }
      const [bg, cls] = heatStyle(v, max);
      html += `<button type="button" class="hm-cell ${cls}" data-r="${r}" data-c="${c}" style="background:${bg}"
        aria-label="${nm(names[r])} × ${nm(names[c])} ${v ?? 0}%">
        ${v ? v.toFixed(v < 10 ? 1 : 0) : "—"}</button>`;
    });
  });
  const grid = $("#heatmapGrid");
  grid.innerHTML = html;

  const setHl = (r, c, on) => {
    grid.querySelector(`.hm-rowhead[data-row="${r}"]`)?.classList.toggle("hl", on);
    grid.querySelector(`.hm-col[data-col="${c}"]`)?.classList.toggle("hl", on);
  };
  grid.querySelectorAll(".hm-cell:not(.empty)").forEach((cell) => {
    const r = +cell.dataset.r, c = +cell.dataset.c;
    cell.addEventListener("mouseenter", () => setHl(r, c, true));
    cell.addEventListener("mouseleave", () => { if (!cell.classList.contains("selected")) setHl(r, c, false); });
    cell.addEventListener("click", () => {
      grid.querySelectorAll(".hm-cell.selected").forEach((x) => {
        x.classList.remove("selected");
        setHl(+x.dataset.r, +x.dataset.c, false);
      });
      cell.classList.add("selected");
      setHl(r, c, true);
      const v = m[r][c] ?? 0;
      $("#matrixCaption").innerHTML = L().heatPick(
        fmt(sims()), `${names[r].flag} ${nm(names[r])}`, `${names[c].flag} ${nm(names[c])}`,
        L().rounds[state.matrix], meetCount(v), v);
    });
  });
}

/* ---------- 强强预警 ---------- */
function renderWatch() {
  const t = L();
  const matchups = S().matchups;
  $("#watchList").innerHTML = matchups.map((w, index) => {
    const round = w.r32 >= w.r16 ? t.rounds.r32 : t.rounds.r16;
    const meeting = Math.max(w.r32, w.r16);
    const winner = typeof w.winner === "string" ? w.winner : `${w.winner.flag} ${nm(w.winner)}`;
    const scores = w.topScores ? w.topScores.map((x) => `<span class="num">${x.score}</span>（${x.p}%）`).join(t.listJoin) : "";
    let factors = "";
    if (w.factorData) {
      const f = w.factorData, ft = t.factors;
      const form = f.played === 0 ? ft.f2wait : ft.f2v(nm(w.a), f.dA, nm(w.b), f.dB);
      factors = `<div class="factor-row">
        <div class="factor"><span>${ft.f1}</span><strong>${ft.f1v(f.xgA, f.xgB)}</strong><small>${ft.f1n}</small></div>
        <div class="factor"><span>${ft.f2}</span><strong>${form}</strong><small>${ft.f2n}</small></div>
        <div class="factor"><span>${ft.f3}</span><strong>${ft.f3v(f.baseA, f.baseB)}</strong><small>${ft.f3n}</small></div>
      </div>`;
    }
    return `<article class="watch-card ${index < 2 ? "critical" : ""}">
      <div class="watch-top">
        <span class="watch-pair">${w.a.flag} ${nm(w.a)}<span class="vs">VS</span>${w.b.flag} ${nm(w.b)}</span>
        <span class="watch-meet">
          <small>${t.watchMeet(fmt(sims()), meetCount(w.total))}</small>
          <strong>${meeting}%</strong>
        </span>
      </div>
      <p class="watch-split">${t.watchSplit(round, w.r32, w.r16, w.eloDiff)}</p>
      ${w.wdl ? `<div class="win-projection">
        <div class="win-bar" aria-hidden="true">
          <i class="wa" style="width:${w.wdl[0]}%"></i><i class="wd" style="width:${w.wdl[1]}%"></i><i class="wb" style="width:${w.wdl[2]}%"></i>
        </div>
        <div class="win-legend">
          <span>${t.win(nm(w.a))} <b class="num">${w.wdl[0]}%</b></span>
          <span>${t.draw} <b class="num">${w.wdl[1]}%</b></span>
          <span>${t.win(nm(w.b))} <b class="num">${w.wdl[2]}%</b></span>
        </div>
      </div>` : ""}
      <p class="watch-note">${t.watchNote(winner, w.winA, w.winB, scores)}</p>
      ${factors}
    </article>`;
  }).join("");

  const m0 = matchups[0];
  $("#watchTitle").textContent = t.watchTitle(`${m0.a.flag} ${nm(m0.a)} vs ${m0.b.flag} ${nm(m0.b)}`);
}

/* ---------- 路径与爆冷 ---------- */
function renderPath() {
  const t = L();
  const byPath = S().teams
    .filter((x) => x.pathCode === "adv")
    .sort((a, b) => a.avgR32OppElo - b.avgR32OppElo)
    .slice(0, 5);
  $("#pathList").innerHTML = byPath.map((x) =>
    `<div class="path-row">
      <span class="path-team">${x.flag} ${nm(x)} <span class="rk-group">${t.group(x.group)}</span></span>
      <span class="path-meta">${t.pathMeta(x.avgR32OppElo, x.p8)}</span>
    </div>`
  ).join("");

  const upsets = [...S().teams]
    .filter((x) => x.eloRank > 10)
    .sort((a, b) => b.upsetChance - a.upsetChance)
    .slice(0, 6);
  $("#upsetList").innerHTML = upsets.map((x) =>
    `<div class="path-row">
      <span class="path-team">${x.flag} ${nm(x)} <span class="rk-group">${t.eloRank(x.eloRank)}</span></span>
      <span class="path-meta">${t.upsetMeta(x.upsetChance, x.p8)}</span>
    </div>`
  ).join("");
}

/* ---------- 对阵图 ---------- */
function renderBracket() {
  const t = L();
  const b = S().bracket;
  const colRounds = [["Round of 32"], ["Round of 16"], ["Quarter-final", "Semi-final"]];
  const half = (which) =>
    colRounds.map((rounds, ci) => {
      const ms = b.filter((m) => m.half === which && rounds.includes(m.round));
      return `<div class="col"><span class="col-label">${t.cols[ci]}</span>` +
        ms.map((m) => matchCard(m, t)).join("") + `</div>`;
    }).join("");
  $("#upperBracket").innerHTML = half("upper");
  $("#lowerBracket").innerHTML = half("lower");

  const f = b.find((m) => m.round === "Final");
  if (f) {
    $("#finalLine").innerHTML =
      `<span class="fl-label">${t.finalLabel}</span>` +
      `<span>${t.finalLine(`${f.a.flag} ${nm(f.a)}`, `${f.b.flag} ${nm(f.b)}`, fmt(sims()), meetCount(f.pairP), `${f.winner.flag} ${nm(f.winner)}`)}</span>`;
  }
}

function matchCard(m, t) {
  const side = (x) =>
    `<div class="m-team ${m.winner.zh === x.zh ? "winner" : ""}"><span>${x.flag} ${nm(x)}</span></div>`;
  return `<div class="match">${side(m.a)}${side(m.b)}<div class="m-p">${t.pairP(m.pairP)}</div></div>`;
}

/* ---------- 控件 ---------- */
function bindControls() {
  document.querySelectorAll("[data-stage]").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("[data-stage]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      state.stage = b.dataset.stage;
      renderRanking();
      renderInsights();
    })
  );
  document.querySelectorAll("[data-matrix]").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("[data-matrix]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      state.matrix = b.dataset.matrix;
      renderMatrix();
    })
  );
  document.querySelectorAll(".lang-btn").forEach((b) =>
    b.addEventListener("click", () => setLang(b.dataset.lang))
  );
  $("#weatherToggle").addEventListener("change", (e) => { state.weather = e.target.checked; renderAll(); });
  $("#hostToggle").addEventListener("change", (e) => { state.host = e.target.checked; renderAll(); });
  $("#bmcLink").href = BMC_URL;
  const top = $("#bmcLinkTop");
  if (top) top.href = BMC_URL;
}

/* ---------- Bento / dock ---------- */
function setupDock() {
  const dock = $("#dock");
  const bento = $("#bentoTop");
  const tabs = [...document.querySelectorAll(".dock-tab[data-target]")];
  const sections = [...document.querySelectorAll("main section[id]")];
  const map = { heatmap: "heatmap", probability: "probability", watch: "watch", path: "path", bracket: "path" };

  const setActive = (key) =>
    tabs.forEach((x) => x.classList.toggle("active", x.dataset.target === key));

  // 点击：立即点亮目标并加锁，平滑滚动途中 spy 不得抢改；
  // 滚动结束（scrollend 或超时兜底）后解锁，交还给位置判定。
  let lockUntil = 0;
  tabs.forEach((b) =>
    b.addEventListener("click", () => {
      setActive(b.dataset.target);
      lockUntil = performance.now() + 1400;
      document.getElementById(b.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
  window.addEventListener("scrollend", () => { lockUntil = 0; });

  // 确定性 spy：取“顶部锚线（140px）之上最近的板块”，无竞态、无闪跳。
  const spyUpdate = () => {
    if (performance.now() < lockUntil) return;
    let current = null;
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= 140) current = map[s.id];
    }
    setActive(current);
  };

  // dock 显隐：滚动位置 + 迟滞区间，杜绝临界抖动。
  let dockShown = false;
  let ticking = false;
  const onFrame = () => {
    ticking = false;
    const b = bento.getBoundingClientRect().bottom;
    if (!dockShown && b < 90) { dockShown = true; dock.classList.add("visible"); }
    else if (dockShown && b > 200) { dockShown = false; dock.classList.remove("visible"); }
    spyUpdate();
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onFrame); }
  }, { passive: true });
  window.addEventListener("resize", onFrame);
  onFrame();
}

init();
