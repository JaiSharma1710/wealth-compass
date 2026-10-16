/**
 * Wealth Compass stock model.
 *
 * Six pillars distilled from the value / quality literature:
 *  - Quality         Buffett letters, Greenblatt (ROC), Novy-Marx (gross profitability), Coffee Can (ROCE >= 15%)
 *  - Growth          Fisher, Lynch, Coffee Can (revenue growth >= 10% every year)
 *  - Strength        Graham (low leverage, current ratio), Piotroski F-score, interest cover
 *  - Earnings quality Sloan (accruals), Buffett "owner earnings" (cash conversion), dilution
 *  - Valuation       Graham, Greenblatt (earnings yield EBIT/EV), FCF yield, PEG (Lynch)
 *  - Momentum        O'Shaughnessy / Asness (12-1 month return, trend)
 * Banks, NBFCs and insurers use a lender-specific branch (ROA, equity/assets, P/B).
 *
 * Everything is point-in-time: `asOf` only sees annual results 90+ days after year end,
 * so the same code powers the app and the historical backtest.
 */
import {
  PILLARS,
  type FinancialPeriod,
  type MetricResult,
  type Pillar,
  type PillarResult,
  type PricePoint,
  type StockCategory,
  type StockFundamentals,
  type StockRating,
  type StockScorecard,
} from "@/lib/stock-model/types";
import { DEFAULT_WEIGHTS, type PillarWeights } from "@/lib/stock-model/weights";

const REPORTING_LAG_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const PILLAR_LABELS: Record<Pillar, string> = {
  quality: "Business quality",
  growth: "Growth",
  strength: "Financial strength",
  earningsQuality: "Earnings quality",
  valuation: "Valuation",
  momentum: "Price momentum",
};

/** Piecewise-linear score through (value, score) points; points sorted by value. */
export function curve(value: number | null | undefined, points: Array<[number, number]>): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= points[0][0]) return points[0][1];

  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1];
    const [x2, y2] = points[index];
    if (value <= x2) return Math.round(y1 + ((value - x1) / (x2 - x1)) * (y2 - y1));
  }

  return points[points.length - 1][1];
}

const num = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? null : value);
const ratio = (a: number | null | undefined, b: number | null | undefined) => {
  const x = num(a);
  const y = num(b);
  return x == null || y == null || y === 0 ? null : x / y;
};
const mean = (values: Array<number | null>) => {
  const valid = values.filter((value): value is number => value != null);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};
const stdev = (values: number[]) => {
  if (values.length < 2) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1));
};
const cagr = (first: number | null, last: number | null, years: number) =>
  first != null && last != null && first > 0 && last > 0 && years > 0 ? (last / first) ** (1 / years) - 1 : null;

export function isFinancialCompany(sector: string | null, industry: string | null) {
  const text = `${sector || ""} ${industry || ""}`.toLowerCase();
  return /bank|credit services|insurance|capital markets|financial conglomerate|mortgage|asset management/.test(text);
}

/** Annual periods published by `asOf` (period end + reporting lag). */
export function availableAnnual(periods: FinancialPeriod[], asOf: Date) {
  return periods.filter((period) => new Date(period.date).getTime() + REPORTING_LAG_DAYS * DAY_MS <= asOf.getTime());
}

/** Last close on or before the date. */
export function priceAt(prices: PricePoint[], date: Date) {
  let found: PricePoint | null = null;
  for (const point of prices) {
    if (new Date(point.date).getTime() <= date.getTime()) found = point;
    else break;
  }
  return found;
}

function roce(period: FinancialPeriod) {
  const ebit = num(period.EBIT) ?? num(period.operatingIncome);
  const capital = num(period.totalAssets) != null && num(period.currentLiabilities) != null
    ? (period.totalAssets as number) - (period.currentLiabilities as number)
    : null;
  return capital && capital > 0 ? ratio(ebit, capital) : null;
}

function roe(period: FinancialPeriod, previous?: FinancialPeriod) {
  const equity = mean([num(period.stockholdersEquity), previous ? num(previous.stockholdersEquity) : null]);
  return equity && equity > 0 ? ratio(period.netIncome, equity) : null;
}

const operatingMargin = (period: FinancialPeriod) => ratio(num(period.operatingIncome) ?? num(period.EBIT), period.totalRevenue);

/** Piotroski F-score (0-9) from the latest two annual periods. */
export function piotroskiScore(current: FinancialPeriod, previous: FinancialPeriod): number | null {
  const roaNow = ratio(current.netIncome, current.totalAssets);
  const roaPrev = ratio(previous.netIncome, previous.totalAssets);

  if (roaNow == null || roaPrev == null) return null;

  const levNow = ratio(current.longTermDebt ?? current.totalDebt, current.totalAssets) ?? 0;
  const levPrev = ratio(previous.longTermDebt ?? previous.totalDebt, previous.totalAssets) ?? 0;
  const crNow = ratio(current.currentAssets, current.currentLiabilities);
  const crPrev = ratio(previous.currentAssets, previous.currentLiabilities);
  const marginNow = ratio(current.grossProfit, current.totalRevenue) ?? operatingMargin(current);
  const marginPrev = ratio(previous.grossProfit, previous.totalRevenue) ?? operatingMargin(previous);
  const turnNow = ratio(current.totalRevenue, current.totalAssets);
  const turnPrev = ratio(previous.totalRevenue, previous.totalAssets);
  const sharesNow = num(current.ordinarySharesNumber) ?? num(current.basicAverageShares);
  const sharesPrev = num(previous.ordinarySharesNumber) ?? num(previous.basicAverageShares);

  const checks = [
    (num(current.netIncome) || 0) > 0,
    (num(current.operatingCashFlow) || 0) > 0,
    roaNow > roaPrev,
    (num(current.operatingCashFlow) || 0) > (num(current.netIncome) || 0),
    levNow <= levPrev,
    crNow != null && crPrev != null ? crNow > crPrev : false,
    sharesNow != null && sharesPrev != null ? sharesNow <= sharesPrev * 1.01 : false,
    marginNow != null && marginPrev != null ? marginNow > marginPrev : false,
    turnNow != null && turnPrev != null ? turnNow > turnPrev : false,
  ];

  return checks.filter(Boolean).length;
}

function metric(
  key: string,
  label: string,
  value: number | null,
  unit: MetricResult["unit"],
  points: Array<[number, number]> | null,
  benchmark: string,
  scoreOverride?: number | null
): MetricResult {
  return {
    key,
    label,
    value: value == null ? null : Math.round(value * 10000) / 10000,
    unit,
    score: scoreOverride !== undefined ? scoreOverride : points ? curve(value, points) : null,
    benchmark,
  };
}

function pillar(key: Pillar, metrics: MetricResult[]): PillarResult {
  const scored = metrics.filter((entry) => entry.score != null);
  // Need at least half of a pillar's metrics to trust its score.
  const score = scored.length && scored.length >= Math.ceil(metrics.length / 2)
    ? Math.round(scored.reduce((sum, entry) => sum + (entry.score as number), 0) / scored.length)
    : null;
  return { pillar: key, label: PILLAR_LABELS[key], score, metrics };
}

function momentumMetrics(prices: PricePoint[], asOf: Date): MetricResult[] {
  const now = priceAt(prices, asOf);
  const monthAgo = priceAt(prices, new Date(asOf.getTime() - 30 * DAY_MS));
  const yearAgo = priceAt(prices, new Date(asOf.getTime() - 365 * DAY_MS));
  const window = prices.filter(
    (point) => new Date(point.date).getTime() <= asOf.getTime() && new Date(point.date).getTime() > asOf.getTime() - 365 * DAY_MS
  );
  const total = (point: PricePoint | null) => (point ? point.adjClose ?? point.close : null);
  const tenMonth = window.slice(-10).map((point) => point.adjClose ?? point.close);
  const ma = tenMonth.length >= 8 ? tenMonth.reduce((sum, value) => sum + value, 0) / tenMonth.length : null;
  const high = window.length ? Math.max(...window.map((point) => point.adjClose ?? point.close)) : null;
  const ret12_1 = monthAgo && yearAgo ? (total(monthAgo) as number) / (total(yearAgo) as number) - 1 : null;
  const vsMa = now && ma ? (total(now) as number) / ma - 1 : null;
  const drawdown = now && high ? (total(now) as number) / high - 1 : null;

  return [
    metric("ret12_1", "12-month return (ex last month)", ret12_1, "pct", [[-0.3, 0], [-0.15, 15], [0, 45], [0.15, 75], [0.3, 100]], "Leaders keep leading: >15% is strong"),
    metric("vsMa", "Price vs 10-month average", vsMa, "pct", [[-0.2, 0], [-0.1, 25], [0, 60], [0.1, 100]], "Above the 10-month average = uptrend"),
    metric("drawdown", "Below 12-month high", drawdown, "pct", [[-0.5, 0], [-0.3, 25], [-0.15, 65], [-0.05, 100]], "Within 15% of the high is healthy"),
  ];
}

export function scoreStock(
  data: StockFundamentals,
  options: { asOf?: Date; weights?: PillarWeights } = {}
): StockScorecard | null {
  const asOf = options.asOf || new Date();
  const weights = options.weights || DEFAULT_WEIGHTS;
  const annual = availableAnnual(data.annual, asOf).filter((period) => num(period.totalRevenue) != null || num(period.netIncome) != null);

  if (annual.length < 2) return null;

  const latest = annual[annual.length - 1];
  const previous = annual[annual.length - 2];
  const years = annual.length - 1;
  const financial = isFinancialCompany(data.sector, data.industry);
  const pricePoint = priceAt(data.prices, asOf);
  const price = pricePoint?.close ?? null;
  const shares = num(latest.ordinarySharesNumber) ?? num(latest.basicAverageShares);
  const marketCap = price != null && shares ? price * shares : null;
  const eps = num(latest.dilutedEPS) ?? (shares ? ratio(latest.netIncome, shares) : null);
  const pe = price != null && eps && eps > 0 ? price / eps : null;

  const revenues = annual.map((period) => num(period.totalRevenue));
  const revenueGrowth = annual.slice(1).map((period, index) => {
    const prior = revenues[index];
    const current = num(period.totalRevenue);
    return prior && current != null && prior > 0 ? current / prior - 1 : null;
  });
  const revenueCagr = cagr(revenues[0], revenues[revenues.length - 1], years);
  const epsSeries = annual.map((period) => {
    const periodShares = num(period.ordinarySharesNumber) ?? num(period.basicAverageShares);
    return num(period.dilutedEPS) ?? (periodShares ? ratio(period.netIncome, periodShares) : null);
  });
  const epsCagr = cagr(epsSeries[0], epsSeries[epsSeries.length - 1], years);
  const netIncomeCagr = cagr(num(annual[0].netIncome), num(latest.netIncome), years);
  const growthYears = revenueGrowth.filter((value) => value != null);
  const consistentYears = growthYears.filter((value) => (value as number) >= 0.1).length;
  const quarterGrowth = latestQuarterGrowth(data.quarterly, asOf);
  const roces = annual.map(roce).filter((value): value is number => value != null);
  const roes = annual.slice(1).map((period, index) => roe(period, annual[index])).filter((value): value is number => value != null);
  const piotroski = piotroskiScore(latest, previous);

  const growth = pillar("growth", [
    metric("revenueCagr", `Revenue growth (${years}y CAGR)`, revenueCagr, "pct", [[0, 5], [0.04, 30], [0.08, 55], [0.12, 75], [0.2, 100]], "Coffee Can: 10%+ a year"),
    metric(
      financial ? "profitCagr" : "epsCagr",
      financial ? `Profit growth (${years}y CAGR)` : `EPS growth (${years}y CAGR)`,
      financial ? netIncomeCagr : epsCagr,
      "pct",
      [[0, 5], [0.04, 30], [0.08, 55], [0.12, 75], [0.2, 100]],
      "Earnings compounding 12%+ a year"
    ),
    metric(
      "growthConsistency",
      "Years with 10%+ revenue growth",
      growthYears.length ? consistentYears / growthYears.length : null,
      "ratio",
      [[0, 0], [1, 100]],
      "Every year, not just on average"
    ),
    metric("quarterGrowth", "Latest quarter revenue vs last year", quarterGrowth, "pct", [[-0.1, 0], [0, 35], [0.08, 70], [0.15, 100]], "Recent momentum in the business"),
  ]);

  let quality: PillarResult;
  let strength: PillarResult;
  let earningsQuality: PillarResult;
  let valuation: PillarResult;

  const sharesFirst = num(annual[0].ordinarySharesNumber) ?? num(annual[0].basicAverageShares);
  const dilution = cagr(sharesFirst, shares, years);

  if (financial) {
    const roa = ratio(latest.netIncome, latest.totalAssets);
    const equityToAssets = ratio(latest.stockholdersEquity, latest.totalAssets);
    const pb = marketCap && num(latest.stockholdersEquity) ? marketCap / (latest.stockholdersEquity as number) : null;

    quality = pillar("quality", [
      metric("roe", "Return on equity", roes.at(-1) ?? null, "pct", [[0.05, 20], [0.1, 45], [0.15, 75], [0.2, 100]], "15%+ for a quality lender"),
      metric("roa", "Return on assets", roa, "pct", [[0, 0], [0.005, 35], [0.01, 70], [0.015, 100]], "1%+ for banks, higher for NBFCs"),
      metric("roeFloor", "Weakest ROE in the period", roes.length ? Math.min(...roes) : null, "pct", [[0.05, 15], [0.1, 50], [0.15, 100]], "Consistency through cycles"),
    ]);
    strength = pillar("strength", [
      metric("equityToAssets", "Equity / assets", equityToAssets, "pct", [[0.06, 35], [0.09, 70], [0.12, 100]], "Thicker capital cushion is safer"),
      metric("profitStability", "Loss-free years", annual.filter((period) => (num(period.netIncome) || 0) > 0).length / annual.length, "ratio", [[0.5, 0], [1, 100]], "Profitable every year"),
      metric("dilution", "Share count growth / yr", dilution, "pct", null, "Lenders raise capital; mergers also add shares", dilution == null ? null : curve(-dilution, [[-0.15, 30], [-0.06, 60], [-0.02, 85], [0, 100]])),
    ]);
    // Cash-flow based earnings-quality tests don't apply to lenders.
    earningsQuality = { pillar: "earningsQuality", label: PILLAR_LABELS.earningsQuality, score: null, metrics: [] };
    valuation = pillar("valuation", [
      metric("pb", "Price / book", pb, "x", null, "Under 2x is reasonable for lenders", pb == null ? null : curve(-pb, [[-5, 15], [-3.5, 40], [-2, 70], [-1, 100]])),
      metric("pe", "Price / earnings", pe, "x", null, "Under 20x is reasonable", pe == null ? 0 : curve(-pe, [[-45, 10], [-30, 35], [-20, 65], [-12, 100]])),
      metric("earningsYield", "Earnings yield", marketCap ? ratio(latest.netIncome, marketCap) : null, "pct", [[0.01, 0], [0.03, 25], [0.05, 55], [0.08, 100]], "Profit you buy per rupee of price"),
    ]);
  } else {
    const debtToEquity = ratio(num(latest.totalDebt) ?? 0, latest.stockholdersEquity);
    const interest = num(latest.interestExpense);
    const ebit = num(latest.EBIT) ?? num(latest.operatingIncome);
    const interestCover = interest && interest > 0 ? ratio(ebit, interest) : (num(latest.totalDebt) || 0) <= 0 ? 50 : null;
    const margins = annual.map(operatingMargin).filter((value): value is number => value != null);
    const cfoSum = annual.slice(-3).reduce((sum, period) => sum + (num(period.operatingCashFlow) || 0), 0);
    const niSum = annual.slice(-3).reduce((sum, period) => sum + (num(period.netIncome) || 0), 0);
    const avgAssets = mean([num(latest.totalAssets), num(previous.totalAssets)]);
    const accruals = avgAssets ? ((num(latest.netIncome) || 0) - (num(latest.operatingCashFlow) || 0)) / avgAssets : null;
    const fcfSeries = annual.map((period) => num(period.freeCashFlow) ?? ((num(period.operatingCashFlow) ?? 0) + (num(period.capitalExpenditure) ?? 0)));
    const fcf = fcfSeries[fcfSeries.length - 1];
    const enterpriseValue = marketCap != null ? marketCap + (num(latest.totalDebt) || 0) - (num(latest.cashAndCashEquivalents) || 0) : null;
    const peg = pe && epsCagr && epsCagr > 0 ? pe / (epsCagr * 100) : null;

    quality = pillar("quality", [
      metric("roce", "Return on capital employed", roces.at(-1) ?? null, "pct", [[0, 0], [0.05, 20], [0.1, 45], [0.15, 70], [0.25, 100]], "Coffee Can / Buffett: 15%+"),
      metric("roe", "Return on equity", roes.at(-1) ?? null, "pct", [[0.05, 20], [0.1, 45], [0.15, 75], [0.2, 100]], "15-20%+ without heavy debt"),
      metric("roceFloor", "Weakest ROCE in the period", roces.length ? Math.min(...roces) : null, "pct", [[0.05, 15], [0.1, 50], [0.15, 100]], "High returns every year = moat"),
      metric("grossProfitability", "Gross profit / assets", ratio(latest.grossProfit, latest.totalAssets), "ratio", [[0.1, 35], [0.25, 70], [0.4, 100]], "Novy-Marx: profitable assets"),
      metric("marginStability", "Operating margin volatility", stdev(margins), "pct", null, "Stable margins signal pricing power", curve(stdev(margins) == null ? null : -(stdev(margins) as number), [[-0.1, 20], [-0.05, 60], [-0.02, 100]])),
    ]);
    strength = pillar("strength", [
      metric("debtToEquity", "Debt / equity", debtToEquity, "x", null, "Graham: below 0.5x", debtToEquity == null ? null : curve(-debtToEquity, [[-3, 0], [-2, 15], [-1, 45], [-0.5, 75], [-0.1, 100]])),
      metric("interestCover", "Interest cover (EBIT / interest)", interestCover, "x", [[1, 0], [1.5, 15], [3, 45], [5, 70], [10, 100]], "5x+ is comfortable"),
      metric("currentRatio", "Current ratio", ratio(latest.currentAssets, latest.currentLiabilities), "x", [[0.7, 20], [1, 50], [1.5, 80], [2, 100]], "Graham: 1.5-2x"),
      metric("piotroski", "Piotroski F-score", piotroski, "score", [[2, 0], [4, 35], [6, 70], [8, 100]], "7+ of 9 health checks"),
    ]);
    earningsQuality = pillar("earningsQuality", [
      metric("cashConversion", "Operating cash flow / profit (3y)", niSum > 0 ? cfoSum / niSum : null, "x", [[0.4, 15], [0.7, 45], [0.9, 75], [1.1, 100]], "Buffett: profits backed by cash"),
      metric("accruals", "Accruals / assets", accruals, "pct", null, "Sloan: low accruals = cleaner earnings", accruals == null ? null : curve(-accruals, [[-0.1, 10], [-0.05, 40], [0, 75], [0.05, 100]])),
      metric("dilution", "Share count growth / yr", dilution, "pct", null, "Avoid repeated dilution", dilution == null ? null : curve(-dilution, [[-0.06, 10], [-0.03, 40], [-0.01, 75], [0, 100]])),
      metric("fcfYears", "Years with positive free cash flow", fcfSeries.length ? fcfSeries.filter((value) => value > 0).length / fcfSeries.length : null, "ratio", [[0, 0], [1, 100]], "Self-funding growth"),
    ]);
    valuation = pillar("valuation", [
      metric("earningsYield", "Earnings yield (EBIT / EV)", enterpriseValue && enterpriseValue > 0 ? ratio(ebit, enterpriseValue) : null, "pct", [[0.01, 0], [0.03, 25], [0.05, 50], [0.07, 75], [0.1, 100]], "Greenblatt: higher is cheaper"),
      metric("fcfYield", "Free cash flow yield", marketCap ? ratio(fcf, marketCap) : null, "pct", [[-0.01, 0], [0, 15], [0.02, 45], [0.04, 75], [0.06, 100]], "4%+ is attractive"),
      metric("pe", "Price / earnings", pe, "x", null, "Context: compare with growth", pe == null ? 0 : curve(-pe, [[-70, 0], [-45, 20], [-30, 45], [-20, 70], [-12, 100]])),
      metric("peg", "PEG (P/E ÷ EPS growth)", peg, "x", null, "Lynch: around 1 or below", peg == null ? null : curve(-peg, [[-3, 20], [-2, 50], [-1.5, 70], [-1, 100]])),
    ]);
  }

  const momentum = pillar("momentum", momentumMetrics(data.prices, asOf));
  const pillars = [quality, growth, strength, earningsQuality, valuation, momentum];
  const available = pillars.filter((entry) => entry.score != null);
  const weightSum = available.reduce((sum, entry) => sum + weights[entry.pillar], 0);
  const score = weightSum
    ? Math.round(available.reduce((sum, entry) => sum + (entry.score as number) * weights[entry.pillar], 0) / weightSum)
    : 0;
  const pillarScore = (key: Pillar) => pillars.find((entry) => entry.pillar === key)?.score ?? null;
  const roceGood = roces.filter((value) => value >= 0.15).length;
  const coffeeMetric = financial ? roes : roces;

  return {
    symbol: data.symbol,
    name: data.name,
    isFinancial: financial,
    asOf: asOf.toISOString(),
    fiscalYear: latest.date,
    yearsOfData: annual.length,
    pillars,
    score,
    rating: ratingFor(score),
    category: categorize(pillarScore, piotroski, score),
    ...explain(pillars),
    coffeeCan: {
      passed: growthYears.length > 0 && consistentYears === growthYears.length && coffeeMetric.length > 0 && coffeeMetric.every((value) => value >= 0.15),
      revenueGrowthYears: `${consistentYears}/${growthYears.length}`,
      roceYears: `${financial ? coffeeMetric.filter((value) => value >= 0.15).length : roceGood}/${coffeeMetric.length}`,
      note: `Checked on ${annual.length} years of data (the original test uses 10).`,
    },
    piotroski,
    price,
    confidence: available.length >= 5 ? "high" : available.length >= 4 ? "medium" : "low",
  };
}

function latestQuarterGrowth(quarters: FinancialPeriod[], asOf: Date) {
  const visible = quarters.filter((period) => new Date(period.date).getTime() + 45 * DAY_MS <= asOf.getTime());
  const latest = visible.at(-1);

  if (!latest) return null;

  const target = new Date(latest.date).getTime() - 365 * DAY_MS;
  const yearAgo = visible.find((period) => Math.abs(new Date(period.date).getTime() - target) < 20 * DAY_MS);
  const now = num(latest.totalRevenue);
  const then = yearAgo ? num(yearAgo.totalRevenue) : null;
  return now != null && then && then > 0 ? now / then - 1 : null;
}

export function ratingFor(score: number): StockRating {
  if (score >= 72) return "strong";
  if (score >= 60) return "good";
  if (score >= 45) return "average";
  if (score >= 32) return "weak";
  return "avoid";
}

function categorize(pillarScore: (key: Pillar) => number | null, piotroski: number | null, score: number): StockCategory {
  const quality = pillarScore("quality") ?? 50;
  const growth = pillarScore("growth") ?? 50;
  const strength = pillarScore("strength") ?? 50;
  const earnings = pillarScore("earningsQuality") ?? 50;
  const valuation = pillarScore("valuation") ?? 50;

  if (quality >= 70 && growth >= 60 && strength >= 55 && valuation >= 35) return "compounder";
  if (quality >= 65 && valuation < 35) return "quality_premium";
  if (valuation >= 65 && (quality < 40 || earnings < 40)) return "value_trap";
  if (valuation >= 60 && quality >= 45 && strength >= 45) return "value_opportunity";
  if (quality < 50 && piotroski != null && piotroski >= 7) return "turnaround";
  if (score < 40 || strength < 30) return "weak";
  return "average";
}

function explain(pillars: PillarResult[]) {
  const scored = pillars.flatMap((entry) => entry.metrics).filter((entry) => entry.score != null);
  const strengths = scored
    .filter((entry) => (entry.score as number) >= 75)
    .sort((a, b) => (b.score as number) - (a.score as number))
    .slice(0, 4)
    .map((entry) => `${entry.label}: ${formatMetric(entry)} (${entry.benchmark})`);
  const concerns = scored
    .filter((entry) => (entry.score as number) <= 35)
    .sort((a, b) => (a.score as number) - (b.score as number))
    .slice(0, 4)
    .map((entry) => `${entry.label}: ${formatMetric(entry)} (${entry.benchmark})`);
  return { strengths, concerns };
}

export function formatMetric(entry: Pick<MetricResult, "value" | "unit">) {
  if (entry.value == null) return "n/a";
  if (entry.unit === "pct") return `${(entry.value * 100).toFixed(1)}%`;
  if (entry.unit === "ratio") return `${Math.round(entry.value * 100)}%`;
  if (entry.unit === "x") return `${entry.value.toFixed(1)}x`;
  return String(Math.round(entry.value * 10) / 10);
}

export { PILLARS };
