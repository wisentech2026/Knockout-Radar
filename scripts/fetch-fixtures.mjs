// scripts/fetch-fixtures.mjs
// 从 openfootball 拉取最新赛程快照（开赛后会包含真实比分），写入 data/fixtures.json。
// openfootball 每日更新一次；如需更高频率可在此替换为其他数据源（见 DATA.md）。
// 运行：node scripts/fetch-fixtures.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const res = await fetch(URL);
if (!res.ok) {
  console.error(`✗ 拉取失败：HTTP ${res.status}，保留现有 fixtures.json`);
  process.exit(1);
}
const data = await res.json();
if (!Array.isArray(data.matches) || data.matches.length < 100) {
  console.error("✗ 数据不完整，保留现有 fixtures.json");
  process.exit(1);
}
writeFileSync(join(root, "data/fixtures.json"), JSON.stringify(data, null, 1));
const played = data.matches.filter((m) => m.score?.ft).length;
console.log(`✓ 赛程已更新：${data.matches.length} 场，其中 ${played} 场有真实比分`);
