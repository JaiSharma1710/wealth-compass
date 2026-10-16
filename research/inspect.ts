// Prints today's scorecard for symbols: RESEARCH_SYMBOLS=ITC.NS,DIXON.NS npm run research:inspect
import fs from "node:fs";
import path from "node:path";

import { formatMetric, scoreStock } from "@/lib/stock-model/score";
import type { StockFundamentals } from "@/lib/stock-model/types";

for (const symbol of (process.env.RESEARCH_SYMBOLS || "ITC.NS").split(",")) {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "research/data", `${symbol}.json`), "utf8")) as StockFundamentals;
  const card = scoreStock(data);
  if (!card) { console.log(symbol, "no score"); continue; }
  console.log(`\n${symbol} ${card.score} ${card.rating} ${card.category} fin=${card.isFinancial} F=${card.piotroski} conf=${card.confidence} fy=${card.fiscalYear}`);
  for (const pillar of card.pillars) {
    console.log(`  ${pillar.pillar.padEnd(16)} ${String(pillar.score).padStart(4)}  ` + pillar.metrics.map((m) => `${m.key}=${formatMetric(m)}(${m.score ?? "-"})`).join(" "));
  }
}
