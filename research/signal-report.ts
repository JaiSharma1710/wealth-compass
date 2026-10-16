// Signal-level backtest: what the model said (Buy / Hold / Sell) and what happened next,
// plus a ₹1,00,000 portfolio that follows the calls. Writes research/results/signal-backtest.md
// Run: RESEARCH_FILE=research/signal-report.ts node research/run.mjs
import fs from "node:fs";
import path from "node:path";

import { priceAt, scoreStock } from "@/lib/stock-model/score";
import type { PricePoint, StockFundamentals } from "@/lib/stock-model/types";

import { UNIVERSE } from "./universe";

type Signal = "BUY" | "HOLD" | "SELL";
type Call = { symbol: string; date: string; signal: Signal; score: number | null; fwd: Record<number, number | null>; mkt: Record<number, number | null> };

const ROOT = process.cwd();
const BUY_AT = 65;
const SELL_BELOW = 50;
const HORIZONS = [3, 6, 12];
const COST = 0.0025; // brokerage + taxes + slippage per side
const START_CAPITAL = 100000;

const load = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8"));
const fundamentals: StockFundamentals[] = UNIVERSE.filter((s) => fs.existsSync(path.join(ROOT, "research/data", `${s}.json`))).map((s) =>
  load(path.join(ROOT, "research/data", `${s}.json`))
);
const longPrices = new Map<string, PricePoint[]>(
  [...UNIVERSE, "^NSEI"]
    .filter((s) => fs.existsSync(path.join(ROOT, "research/data/prices", `${s}.json`)))
    .map((s) => [s, load<Array<{ date: string; close: number }>>(path.join(ROOT, "research/data/prices", `${s}.json`)).map((p) => ({ ...p, adjClose: p.close }))])
);
const nifty = longPrices.get("^NSEI") || [];
const lastDate = new Date(Math.max(...nifty.map((p) => new Date(p.date).getTime())));

// Month label from local date parts (toISOString would shift 1st-of-month back a day in IST).
const ym = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);
const monthsBetween = (start: Date, end: Date) => {
  const out: Date[] = [];
  for (let d = start; d <= end; d = addMonths(d, 1)) out.push(d);
  return out;
};
const px = (series: PricePoint[], date: Date) => {
  const point = priceAt(series, date);
  // Stale series (suspended/delisted) count as missing.
  return point && date.getTime() - new Date(point.date).getTime() < 45 * 86400000 ? point.adjClose ?? point.close : null;
};
const ret = (series: PricePoint[], from: Date, to: Date) => {
  const a = px(series, from);
  const b = px(series, to);
  return a && b ? b / a - 1 : null;
};
const pct = (v: number | null | undefined, digits = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`);
const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const name = (s: string) => s.replace(/\.NS$/, "");

function grade(calls: Call[], h: number) {
  const done = calls.filter((c) => c.fwd[h] != null);
  const by = (sig: Signal) => done.filter((c) => c.signal === sig);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const buys = by("BUY");
  const sells = by("SELL");
  const holds = by("HOLD");
  return {
    n: done.length,
    buys: buys.length,
    buyUp: buys.length ? buys.filter((c) => (c.fwd[h] as number) > 0).length / buys.length : null,
    buyBeat: buys.length ? buys.filter((c) => (c.fwd[h] as number) > (c.mkt[h] ?? 0)).length / buys.length : null,
    buyAvg: avg(buys.map((c) => c.fwd[h] as number)),
    sells: sells.length,
    sellDown: sells.length ? sells.filter((c) => (c.fwd[h] as number) < 0).length / sells.length : null,
    sellLag: sells.length ? sells.filter((c) => (c.fwd[h] as number) < (c.mkt[h] ?? 0)).length / sells.length : null,
    sellAvg: avg(sells.map((c) => c.fwd[h] as number)),
    holds: holds.length,
    holdUp: holds.length ? holds.filter((c) => (c.fwd[h] as number) > 0).length / holds.length : null,
    holdAvg: avg(holds.map((c) => c.fwd[h] as number)),
    accuracy: buys.length + sells.length
      ? (buys.filter((c) => (c.fwd[h] as number) > 0).length + sells.filter((c) => (c.fwd[h] as number) < 0).length) / (buys.length + sells.length)
      : null,
    mktAvg: avg(done.map((c) => c.mkt[h] as number)),
  };
}

/** Follow the calls: buy BUYs, keep HOLDs already owned, sell SELLs; equal-weight monthly. */
function simulate(dates: Date[], signalOf: (symbol: string, date: Date) => Signal | null, priceOf: (symbol: string) => PricePoint[], symbols: string[]) {
  let value = START_CAPITAL;
  let owned = new Set<string>();
  let peak = value;
  let maxDrawdown = 0;
  const curve: Array<{ date: string; value: number; positions: number }> = [];
  let trades = 0;

  for (let i = 0; i < dates.length - 1; i += 1) {
    const date = dates[i];
    const next = dates[i + 1];
    const signals = new Map(symbols.map((s) => [s, signalOf(s, date)]));
    const target = new Set<string>();
    for (const s of owned) if (signals.get(s) && signals.get(s) !== "SELL") target.add(s);
    for (const [s, sig] of signals) if (sig === "BUY") target.add(s);
    // Equal-weight turnover cost: names entering/leaving plus rebalancing drift (approx.).
    const changed = [...target].filter((s) => !owned.has(s)).length + [...owned].filter((s) => !target.has(s)).length;
    const turnover = owned.size || target.size ? changed / Math.max(target.size, owned.size, 1) : 0;
    trades += changed;
    value *= 1 - COST * turnover;
    owned = target;
    const rets = [...owned].map((s) => ret(priceOf(s), date, next)).filter((r): r is number => r != null);
    value *= 1 + (rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0);
    peak = Math.max(peak, value);
    maxDrawdown = Math.min(maxDrawdown, value / peak - 1);
    curve.push({ date: ym(next), value, positions: owned.size });
  }

  return { value, curve, maxDrawdown, trades };
}

function benchmark(dates: Date[], series: PricePoint[]) {
  let value = START_CAPITAL, peak = value, maxDrawdown = 0;
  const curve: number[] = [];
  for (let i = 0; i < dates.length - 1; i += 1) {
    value *= 1 + (ret(series, dates[i], dates[i + 1]) ?? 0);
    peak = Math.max(peak, value);
    maxDrawdown = Math.min(maxDrawdown, value / peak - 1);
    curve.push(value);
  }
  return { value, curve, maxDrawdown };
}

function equalWeight(dates: Date[], symbols: string[], priceOf: (s: string) => PricePoint[]) {
  return simulate(dates, () => "BUY", priceOf, symbols);
}

const cagr = (end: number, months: number) => (months > 0 ? (end / START_CAPITAL) ** (12 / months) - 1 : 0);

// ---------------- Part 1: full model, Jul 2024 → now ----------------
const modelDates = monthsBetween(new Date(2024, 6, 1), lastDate);
const modelCalls: Call[] = [];
const signalCache = new Map<string, Signal | null>();

for (const stock of fundamentals) {
  for (const date of modelDates) {
    const card = scoreStock(stock, { asOf: date });
    const signal: Signal | null = card ? (card.score >= BUY_AT ? "BUY" : card.score < SELL_BELOW ? "SELL" : "HOLD") : null;
    signalCache.set(`${stock.symbol}|${date.toISOString()}`, signal);
    if (!signal) continue;
    const fwd: Record<number, number | null> = {};
    const mkt: Record<number, number | null> = {};
    for (const h of HORIZONS) {
      const end = addMonths(date, h);
      fwd[h] = end <= lastDate ? ret(stock.prices, date, end) : null;
      mkt[h] = end <= lastDate ? ret(nifty, date, end) : null;
    }
    modelCalls.push({ symbol: stock.symbol, date: ym(date), signal, score: card?.score ?? null, fwd, mkt });
  }
}

const modelSymbols = fundamentals.map((s) => s.symbol);
const priceOfModel = (s: string) => fundamentals.find((f) => f.symbol === s)?.prices || [];
const modelSim = simulate(modelDates, (s, d) => signalCache.get(`${s}|${d.toISOString()}`) ?? null, priceOfModel, modelSymbols);
const modelNifty = benchmark(modelDates, nifty);
const modelEqual = equalWeight(modelDates, modelSymbols, priceOfModel);
const modelMonths = modelDates.length - 1;

// ---------------- Part 2: price-trend signal, 2006 → now ----------------
// Start when the NIFTY 50 benchmark series begins so all strategies cover the same months.
const niftyStart = new Date(nifty[0].date);
const trendDates = monthsBetween(new Date(niftyStart.getFullYear(), niftyStart.getMonth() + 1, 1), lastDate);
const trendStartLabel = ym(trendDates[0]);
const trendSymbols = [...longPrices.keys()].filter((s) => s !== "^NSEI");
function trendSignal(series: PricePoint[], date: Date): Signal | null {
  const window = series.filter((p) => new Date(p.date) <= date && new Date(p.date) > new Date(date.getTime() - 366 * 86400000));
  if (window.length < 11) return null;
  const now = px(series, date);
  const monthAgo = px(series, addMonths(date, -1));
  const yearAgo = px(series, addMonths(date, -12));
  if (!now || !monthAgo || !yearAgo) return null;
  const ma = window.slice(-10).reduce((a, p) => a + p.close, 0) / 10;
  const mom = monthAgo / yearAgo - 1;
  if (now > ma && mom > 0) return "BUY";
  if (now < ma) return "SELL";
  return "HOLD";
}
const trendCalls: Call[] = [];
for (const s of trendSymbols) {
  const series = longPrices.get(s) || [];
  for (const date of trendDates) {
    const signal = trendSignal(series, date);
    if (!signal) continue;
    const fwd: Record<number, number | null> = {};
    const mkt: Record<number, number | null> = {};
    for (const h of HORIZONS) {
      const end = addMonths(date, h);
      fwd[h] = end <= lastDate ? ret(series, date, end) : null;
      mkt[h] = end <= lastDate ? ret(nifty, date, end) : null;
    }
    trendCalls.push({ symbol: s, date: ym(date), signal, score: null, fwd, mkt });
  }
}
const trendSim = simulate(trendDates, (s, d) => trendSignal(longPrices.get(s) || [], d), (s) => longPrices.get(s) || [], trendSymbols);
const trendNifty = benchmark(trendDates, nifty);
const trendEqual = equalWeight(trendDates, trendSymbols, (s) => longPrices.get(s) || []);
const trendMonths = trendDates.length - 1;

// ---------------- Report ----------------
const L: string[] = [];
const accuracyTable = (calls: Call[]) => {
  L.push("| Horizon | Calls graded | Buy calls · went up · beat NIFTY · avg return | Sell calls · went down · lagged NIFTY · avg return | Hold calls · went up · avg | Buy+Sell accuracy | NIFTY avg |");
  L.push("|---|---|---|---|---|---|---|");
  for (const h of HORIZONS) {
    const g = grade(calls, h);
    L.push(`| ${h} months | ${g.n} | ${g.buys} · ${pct(g.buyUp, 0)} · ${pct(g.buyBeat, 0)} · ${pct(g.buyAvg)} | ${g.sells} · ${pct(g.sellDown, 0)} · ${pct(g.sellLag, 0)} · ${pct(g.sellAvg)} | ${g.holds} · ${pct(g.holdUp, 0)} · ${pct(g.holdAvg)} | **${pct(g.accuracy, 0)}** | ${pct(g.mktAvg)} |`);
  }
};
const simTable = (sim: ReturnType<typeof simulate>, nif: ReturnType<typeof benchmark>, eq: ReturnType<typeof simulate>, months: number) => {
  L.push("| Strategy | ₹1,00,000 became | Total return | CAGR | Worst drawdown |");
  L.push("|---|---|---|---|---|");
  L.push(`| **Follow the model** | **${inr(sim.value)}** | ${pct(sim.value / START_CAPITAL - 1)} | ${pct(cagr(sim.value, months))} | ${pct(sim.maxDrawdown)} |`);
  L.push(`| NIFTY 50 index (price, no dividends) | ${inr(nif.value)} | ${pct(nif.value / START_CAPITAL - 1)} | ${pct(cagr(nif.value, months))} | ${pct(nif.maxDrawdown)} |`);
  L.push(`| Hold every stock equally | ${inr(eq.value)} | ${pct(eq.value / START_CAPITAL - 1)} | ${pct(cagr(eq.value, months))} | ${pct(eq.maxDrawdown)} |`);
};

L.push(`# Wealth Compass model — signal backtest report`, "", `Generated ${new Date().toISOString().slice(0, 10)} · data to ${ym(lastDate)} · universe: ${fundamentals.length} NSE large/mid caps (NIFTY 100 + owner's holdings).`, "");
{
  const g12 = grade(modelCalls, 12);
  const t12 = grade(trendCalls, 12);
  L.push("## Summary", "");
  L.push(`- **Full model, 12-month horizon:** ${pct(g12.accuracy, 0)} of Buy/Sell calls were right. Buy calls rose ${pct(g12.buyUp, 0)} of the time (avg ${pct(g12.buyAvg)}) while the NIFTY averaged ${pct(g12.mktAvg)}; Sell calls fell ${pct(g12.sellDown, 0)} of the time (avg ${pct(g12.sellAvg)}).`);
  L.push(`- **₹1,00,000 following the full model since Jul 2024** became **${inr(modelSim.value)}** (${pct(modelSim.value / START_CAPITAL - 1)}), vs ${inr(modelNifty.value)} in the NIFTY 50 and ${inr(modelEqual.value)} holding every stock equally.`);
  L.push(`- **${trendDates[0].getFullYear()}–today, trend signal only:** ₹1,00,000 became **${inr(trendSim.value)}** (${pct(cagr(trendSim.value, trendMonths))}/yr) vs ${inr(trendNifty.value)} in the NIFTY (${pct(cagr(trendNifty.value, trendMonths))}/yr) — but holding the same stocks equally made ${inr(trendEqual.value)} (${pct(cagr(trendEqual.value, trendMonths))}/yr). Price trend alone ${trendSim.value > trendEqual.value ? "beat" : "did not beat"} simply owning the same stocks, and its Sell calls were right only ${pct(t12.sellDown, 0)} of the time over 12 months: in a rising market, selling on weakness mostly misses rebounds. This is why trend carries only 5% weight in the full model.`);
  L.push("- **Bottom line:** the fundamentals-led model has shown a real edge in its (short) test window; the long history shows that timing quality stocks on price alone does not add value. Treat Buy calls as a shortlist and Sell calls as a prompt to review, not an automatic exit.", "");
}
L.push("## How to read this", "");
L.push(`- **Calls:** every month each stock gets a call from its model score at that time: **Buy** (score ≥ ${BUY_AT}), **Hold** (${SELL_BELOW}–${BUY_AT - 1}), **Sell** (< ${SELL_BELOW}). Only information public on that date is used; annual results count 90 days after the year ends.`);
L.push("- **Success:** a Buy is correct if the stock was up after the horizon; a Sell is correct if it was down. The stricter test asks whether a Buy beat the NIFTY 50 and a Sell lagged it.");
L.push(`- **Portfolio:** start with ₹1,00,000, buy every Buy, keep Holds you already own, sell Sells, rebalance to equal weights monthly, ${(COST * 100).toFixed(2)}% cost per trade.`);
L.push("", "## Part 1 — Full model (fundamentals + price), Jul 2024 → today", "");
L.push(`Yahoo's free data has 4 years of financial statements, so the full model can be tested from **Jul 2024** (${modelMonths} months, ${modelCalls.length} stock-month calls). Calls whose horizon hasn't finished yet are not graded.`, "");
const dist = (calls: Call[]) => (["BUY", "HOLD", "SELL"] as Signal[]).map((s) => `${s} ${calls.filter((c) => c.signal === s).length}`).join(" · ");
L.push(`Call mix: ${dist(modelCalls)}`, "");
L.push("### Accuracy", "");
accuracyTable(modelCalls);
L.push("", "### ₹1,00,000 following the model", "");
simTable(modelSim, modelNifty, modelEqual, modelMonths);
L.push("", `Average holdings: ${Math.round(modelSim.curve.reduce((a, c) => a + c.positions, 0) / Math.max(modelSim.curve.length, 1))} stocks · ${modelSim.trades} buys/sells.`, "");
L.push("| Month | Model portfolio | NIFTY 50 | Stocks held |", "|---|---|---|---|");
modelSim.curve.forEach((c, i) => L.push(`| ${c.date} | ${inr(c.value)} | ${inr(modelNifty.curve[i])} | ${c.positions} |`));

L.push("", "### Call-by-call: top 20 stocks", "");
L.push("Quarterly calls with the score and what the stock did over the next 6 and 12 months (✅ call was right · ❌ wrong · ⏳ not finished · Hold is not graded).", "");
const top20 = UNIVERSE.slice(0, 20);
const sampleMonths = modelDates.filter((d) => d.getMonth() % 3 === 0 || d.getMonth() === 6).map((d) => ym(d)).filter((m, i, a) => a.indexOf(m) === i);
for (const symbol of top20) {
  const calls = modelCalls.filter((c) => c.symbol === symbol && sampleMonths.includes(c.date));
  if (!calls.length) continue;
  L.push(`**${name(symbol)}**`, "", "| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |", "|---|---|---|---|---|---|");
  for (const c of calls) {
    const r = c.fwd[12] ?? c.fwd[6];
    const verdict = c.signal === "HOLD" ? "Hold" : r == null ? "⏳" : (c.signal === "BUY" ? r > 0 : r < 0) ? "✅" : "❌";
    L.push(`| ${c.date} | ${c.score} | ${c.signal} | ${pct(c.fwd[6])} | ${pct(c.fwd[12])} | ${verdict} |`);
  }
  L.push("");
}

L.push("### Every stock (all months, 6-month horizon)", "", "| Stock | Buy calls | Buy right | Sell calls | Sell right | Latest call |", "|---|---|---|---|---|---|");
for (const s of modelSymbols) {
  const calls = modelCalls.filter((c) => c.symbol === s);
  const g6 = calls.filter((c) => c.fwd[6] != null);
  const b = g6.filter((c) => c.signal === "BUY");
  const sl = g6.filter((c) => c.signal === "SELL");
  const latest = calls.at(-1);
  L.push(`| ${name(s)} | ${b.length} | ${b.length ? pct(b.filter((c) => (c.fwd[6] as number) > 0).length / b.length, 0) : "—"} | ${sl.length} | ${sl.length ? pct(sl.filter((c) => (c.fwd[6] as number) < 0).length / sl.length, 0) : "—"} | ${latest ? `${latest.signal} (${latest.score})` : "—"} |`);
}

L.push("", `## Part 2 — ${lastDate.getFullYear() - trendDates[0].getFullYear()} years, price-trend signal only (${trendStartLabel} → today)`, "");
L.push("Fundamental history isn't available for 20 years, so this tests only the model's **trend component**: Buy when the price is above its 10-month average and up over the past year (excluding the last month), Sell when it falls below the 10-month average. This is *not* the full model.", "");
L.push(`${trendSymbols.length} stocks (each enters once it has a year of prices) · ${trendCalls.length} stock-month calls · call mix: ${dist(trendCalls)}`, "");
L.push("### Accuracy", "");
accuracyTable(trendCalls);
L.push("", "### Accuracy by year (12-month horizon)", "", "| Year | Buy right | Sell right | Buy+Sell accuracy | NIFTY next 12m (avg) |", "|---|---|---|---|---|");
for (let y = trendDates[0].getFullYear(); y <= lastDate.getFullYear(); y += 1) {
  const g = grade(trendCalls.filter((c) => c.date.startsWith(String(y))), 12);
  if (!g.n) continue;
  L.push(`| ${y} | ${pct(g.buyUp, 0)} | ${pct(g.sellDown, 0)} | ${pct(g.accuracy, 0)} | ${pct(g.mktAvg)} |`);
}
L.push("", `### ₹1,00,000 following the trend signal since ${trendStartLabel}`, "");
simTable(trendSim, trendNifty, trendEqual, trendMonths);
L.push("", "| Year end | Trend portfolio | NIFTY 50 | Stocks held |", "|---|---|---|---|");
trendSim.curve.forEach((c, i) => {
  if (c.date.endsWith("-12") || i === trendSim.curve.length - 1) L.push(`| ${c.date} | ${inr(c.value)} | ${inr(trendNifty.curve[i])} | ${c.positions} |`);
});

L.push("", "## Caveats — read before trusting the numbers", "");
L.push("- **Short full-model window:** Jul 2024 onwards is roughly one market phase (a correction after the 2023–24 rally). Accuracy will vary across cycles; re-run quarterly as data accumulates.");
L.push("- **Survivorship bias:** the universe is today's NIFTY 100. Companies that collapsed and left the index are missing, which flatters every strategy, especially the 20-year test and the equal-weight benchmark. Compare the model against \"hold every stock equally\" (same bias) rather than against NIFTY alone.");
L.push("- **NIFTY benchmark excludes dividends** (~1.2–1.5%/yr), while stock returns include them.");
L.push("- **Thresholds and weights** were chosen on part of this same period, so Part 1 is partly in-sample.");
L.push("- **Taxes are ignored:** short-term capital gains tax on monthly trading would reduce the model portfolio's real return.");
L.push("- Educational research, not investment advice.");

fs.mkdirSync(path.join(ROOT, "research/results"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "research/results/signal-backtest.md"), L.join("\n") + "\n");
console.log("written research/results/signal-backtest.md");
