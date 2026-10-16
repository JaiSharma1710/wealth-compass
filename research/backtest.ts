// Point-in-time backtest of the stock model. Run: npm run research:backtest
//
// For each formation date we score every stock using only data public at that date,
// then measure the next-12-month total return relative to the universe median.
// Weights are tuned with leave-one-year-out cross-validation and shrunk toward the
// literature prior to limit overfitting on a short history.
import fs from "node:fs";
import path from "node:path";

import { priceAt, scoreStock } from "@/lib/stock-model/score";
import { PILLARS, type Pillar, type StockFundamentals } from "@/lib/stock-model/types";
import { PRIOR_WEIGHTS, type PillarWeights } from "@/lib/stock-model/weights";

const DATA_DIR = path.join(process.cwd(), "research/data");
const OUT_DIR = path.join(process.cwd(), "research/results");
const HORIZON_DAYS = 365;

type Observation = {
  symbol: string;
  date: string;
  year: number;
  pillars: Partial<Record<Pillar, number>>;
  defaultScore: number;
  excess: number;
};

const universe: StockFundamentals[] = fs
  .readdirSync(DATA_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")));

const lastPriceDate = new Date(Math.max(...universe.flatMap((stock) => stock.prices.map((point) => new Date(point.date).getTime()))));
const formationDates: Date[] = [];
// Yahoo provides ~4 usable annual years, so the first date with 2+ years published is Jul 2024.
for (let date = new Date("2024-07-01"); date.getTime() + HORIZON_DAYS * 86400000 <= lastPriceDate.getTime(); date = new Date(date.getFullYear(), date.getMonth() + 3, 1)) {
  formationDates.push(date);
}

function totalReturn(stock: StockFundamentals, from: Date, to: Date) {
  const start = priceAt(stock.prices, from);
  const end = priceAt(stock.prices, to);
  if (!start || !end || new Date(end.date) <= new Date(start.date)) return null;
  // Guard against stale series (delisted / missing months).
  if (to.getTime() - new Date(end.date).getTime() > 45 * 86400000) return null;
  return (end.adjClose ?? end.close) / (start.adjClose ?? start.close) - 1;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function ranks(values: number[]) {
  const order = values.map((value, index) => [value, index] as const).sort((a, b) => a[0] - b[0]);
  const result = new Array(values.length).fill(0);
  order.forEach(([, index], rank) => (result[index] = rank));
  return result;
}

function spearman(x: number[], y: number[]) {
  if (x.length < 5) return null;
  const rx = ranks(x);
  const ry = ranks(y);
  const n = x.length;
  const mx = (n - 1) / 2;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (rx[i] - mx) * (ry[i] - mx);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - mx) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

// 1. Build observations.
const observations: Observation[] = [];
for (const date of formationDates) {
  const end = new Date(date.getTime() + HORIZON_DAYS * 86400000);
  const rows: Array<Omit<Observation, "excess"> & { ret: number }> = [];

  for (const stock of universe) {
    const card = scoreStock(stock, { asOf: date });
    const ret = totalReturn(stock, date, end);
    if (!card || ret == null) continue;
    const pillars: Partial<Record<Pillar, number>> = {};
    for (const entry of card.pillars) if (entry.score != null) pillars[entry.pillar] = entry.score;
    rows.push({ symbol: stock.symbol, date: date.toISOString().slice(0, 10), year: date.getFullYear(), pillars, defaultScore: card.score, ret });
  }

  const mid = median(rows.map((row) => row.ret));
  for (const row of rows) observations.push({ ...row, excess: row.ret - mid });
}

const composite = (obs: Observation, weights: PillarWeights) => {
  let sum = 0, total = 0;
  for (const pillar of PILLARS) {
    const value = obs.pillars[pillar];
    if (value != null && weights[pillar] > 0) { sum += value * weights[pillar]; total += weights[pillar]; }
  }
  return total ? sum / total : 50;
};

function evaluate(obs: Observation[], scorer: (o: Observation) => number) {
  const byDate = new Map<string, Observation[]>();
  obs.forEach((o) => byDate.set(o.date, [...(byDate.get(o.date) || []), o]));
  const ics: number[] = [];
  const spreads: number[] = [];
  const hits: number[] = [];
  const quintiles = [0, 0, 0, 0, 0];
  let dates = 0;

  for (const rows of byDate.values()) {
    const scores = rows.map(scorer);
    const ic = spearman(scores, rows.map((row) => row.excess));
    if (ic == null) continue;
    ics.push(ic);
    const sorted = rows.map((row, index) => ({ row, score: scores[index] })).sort((a, b) => b.score - a.score);
    const size = Math.floor(sorted.length / 5);
    const bucket = (q: number) => sorted.slice(q * size, q === 4 ? sorted.length : (q + 1) * size);
    for (let q = 0; q < 5; q += 1) quintiles[q] += bucket(q).reduce((sum, item) => sum + item.row.excess, 0) / bucket(q).length;
    spreads.push(bucket(0).reduce((s, i) => s + i.row.excess, 0) / bucket(0).length - bucket(4).reduce((s, i) => s + i.row.excess, 0) / bucket(4).length);
    hits.push(bucket(0).filter((item) => item.row.excess > 0).length / bucket(0).length);
    dates += 1;
  }

  const avg = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);
  const icMean = avg(ics);
  const icStd = Math.sqrt(avg(ics.map((value) => (value - icMean) ** 2)));
  return {
    ic: icMean,
    icT: icStd ? (icMean / icStd) * Math.sqrt(ics.length) : 0,
    spread: avg(spreads),
    hitRate: avg(hits),
    quintiles: quintiles.map((value) => value / Math.max(dates, 1)),
    dates,
  };
}

// 2. Individual pillar predictive power.
const pillarStats = PILLARS.map((pillar) => ({ pillar, ...evaluate(observations.filter((o) => o.pillars[pillar] != null), (o) => o.pillars[pillar] as number) }));

// 3. Weight search (grid, normalised) with leave-one-year-out CV.
const steps = [0, 0.1, 0.2, 0.3];
const grid: PillarWeights[] = [];
(function build(index: number, current: number[]) {
  if (index === PILLARS.length) {
    const total = current.reduce((s, v) => s + v, 0);
    if (total > 0) grid.push(Object.fromEntries(PILLARS.map((p, i) => [p, current[i] / total])) as PillarWeights);
    return;
  }
  for (const step of steps) build(index + 1, [...current, step]);
})(0, []);

const best = (obs: Observation[]) => {
  let top = { weights: PRIOR_WEIGHTS, ic: -Infinity };
  for (const weights of grid) {
    const { ic } = evaluate(obs, (o) => composite(o, weights));
    if (ic > top.ic) top = { weights, ic };
  }
  return top;
};

const shrink = (weights: PillarWeights, toward: PillarWeights, alpha = 0.5) =>
  Object.fromEntries(PILLARS.map((p) => [p, Math.round((alpha * weights[p] + (1 - alpha) * toward[p]) * 1000) / 1000])) as PillarWeights;

const years = [...new Set(observations.map((o) => o.year))];
const folds = years.map((year) => {
  const train = observations.filter((o) => o.year !== year);
  const test = observations.filter((o) => o.year === year);
  const fitted = shrink(best(train).weights, PRIOR_WEIGHTS);
  return { year, prior: evaluate(test, (o) => composite(o, PRIOR_WEIGHTS)), tuned: evaluate(test, (o) => composite(o, fitted)), fitted };
});
const fullFit = best(observations);
const finalWeights = shrink(fullFit.weights, PRIOR_WEIGHTS);
const priorAll = evaluate(observations, (o) => composite(o, PRIOR_WEIGHTS));
const finalAll = evaluate(observations, (o) => composite(o, finalWeights));

// 3b. Momentum has 10 years of price history: test it on its own over the long run,
// since 15 months of fundamentals cover a single market phase.
const longMomentum = (() => {
  const obs: Observation[] = [];
  for (let date = new Date("2017-01-01"); date.getTime() + HORIZON_DAYS * 86400000 <= lastPriceDate.getTime(); date = new Date(date.getFullYear(), date.getMonth() + 3, 1)) {
    const end = new Date(date.getTime() + HORIZON_DAYS * 86400000);
    const rows: Array<{ symbol: string; score: number; ret: number }> = [];
    for (const stock of universe) {
      const back = (days: number) => priceAt(stock.prices, new Date(date.getTime() - days * 86400000));
      const now = back(0), monthAgo = back(30), yearAgo = back(365);
      const ret = totalReturn(stock, date, end);
      if (!now || !monthAgo || !yearAgo || ret == null || date.getTime() - new Date(yearAgo.date).getTime() > 400 * 86400000) continue;
      rows.push({ symbol: stock.symbol, score: (monthAgo.adjClose ?? monthAgo.close) / (yearAgo.adjClose ?? yearAgo.close) - 1, ret });
    }
    const mid = median(rows.map((row) => row.ret));
    rows.forEach((row) => obs.push({ symbol: row.symbol, date: date.toISOString().slice(0, 10), year: date.getFullYear(), pillars: { momentum: row.score }, defaultScore: 0, excess: row.ret - mid }));
  }
  return evaluate(obs, (o) => o.pillars.momentum as number);
})();

// 4. Report.
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const lines = [
  `# Stock model backtest — ${new Date().toISOString().slice(0, 10)}`,
  "",
  `Universe: ${universe.length} NSE stocks · ${formationDates.length} quarterly formation dates (${formationDates[0]?.toISOString().slice(0, 7)} → ${formationDates.at(-1)?.toISOString().slice(0, 7)}) · ${observations.length} stock-date observations · horizon 12 months, return vs universe median.`,
  "",
  "## Each pillar on its own",
  "| Pillar | Rank IC | IC t-stat | Top−bottom quintile | Top-quintile hit rate |",
  "|---|---|---|---|---|",
  ...pillarStats.map((s) => `| ${s.pillar} | ${s.ic.toFixed(3)} | ${s.icT.toFixed(2)} | ${pct(s.spread)} | ${pct(s.hitRate)} |`),
  "",
  `Long-run momentum check (12-1 month return, price-only, 2017 onwards, ${longMomentum.dates} dates): IC ${longMomentum.ic.toFixed(3)} (t ${longMomentum.icT.toFixed(2)}), top−bottom ${pct(longMomentum.spread)}, hit rate ${pct(longMomentum.hitRate)}.`,
  "",
  "## Composite",
  "| Weights | Rank IC | IC t-stat | Top−bottom | Hit rate | Quintile excess returns (Q1 best → Q5) |",
  "|---|---|---|---|---|---|",
  `| Literature prior | ${priorAll.ic.toFixed(3)} | ${priorAll.icT.toFixed(2)} | ${pct(priorAll.spread)} | ${pct(priorAll.hitRate)} | ${priorAll.quintiles.map(pct).join(" / ")} |`,
  `| Calibrated (in-sample) | ${finalAll.ic.toFixed(3)} | ${finalAll.icT.toFixed(2)} | ${pct(finalAll.spread)} | ${pct(finalAll.hitRate)} | ${finalAll.quintiles.map(pct).join(" / ")} |`,
  "",
  "## Out-of-sample (leave one year out)",
  "| Held-out year | Prior IC | Tuned IC | Prior spread | Tuned spread |",
  "|---|---|---|---|---|",
  ...folds.map((f) => `| ${f.year} | ${f.prior.ic.toFixed(3)} | ${f.tuned.ic.toFixed(3)} | ${pct(f.prior.spread)} | ${pct(f.tuned.spread)} |`),
  "",
  "## Calibrated weights (50% optimised, 50% prior)",
  "```json",
  JSON.stringify(finalWeights, null, 2),
  "```",
];

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "latest.md"), lines.join("\n") + "\n");
fs.writeFileSync(path.join(OUT_DIR, "latest.json"), JSON.stringify({ finalWeights, priorAll, finalAll, pillarStats, folds, longMomentum }, null, 2));
console.log(lines.join("\n"));
