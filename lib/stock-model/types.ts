/** One reporting period (annual or quarterly), values in the company's reporting currency. */
export type FinancialPeriod = {
  date: string; // period end, yyyy-mm-dd
  totalRevenue?: number | null;
  grossProfit?: number | null;
  operatingIncome?: number | null;
  EBIT?: number | null;
  pretaxIncome?: number | null;
  netIncome?: number | null;
  dilutedEPS?: number | null;
  interestExpense?: number | null;
  totalAssets?: number | null;
  currentAssets?: number | null;
  currentLiabilities?: number | null;
  stockholdersEquity?: number | null;
  totalDebt?: number | null;
  longTermDebt?: number | null;
  cashAndCashEquivalents?: number | null;
  retainedEarnings?: number | null;
  operatingCashFlow?: number | null;
  capitalExpenditure?: number | null;
  freeCashFlow?: number | null;
  ordinarySharesNumber?: number | null;
  basicAverageShares?: number | null;
};

/** close: as traded (not split-adjusted) to match reported EPS/shares; adjClose: total return. */
export type PricePoint = { date: string; close: number; adjClose?: number };

export type StockFundamentals = {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  /** Oldest first. */
  annual: FinancialPeriod[];
  quarterly: FinancialPeriod[];
  /** Monthly closes, oldest first. */
  prices: PricePoint[];
};

export const PILLARS = ["quality", "growth", "strength", "earningsQuality", "valuation", "momentum"] as const;
export type Pillar = (typeof PILLARS)[number];

export type MetricResult = {
  key: string;
  label: string;
  value: number | null;
  /** Display format hint. */
  unit: "pct" | "x" | "ratio" | "score" | "years";
  /** 0-100, null when the metric could not be computed. */
  score: number | null;
  /** One-line explanation of what good looks like. */
  benchmark: string;
};

export type PillarResult = {
  pillar: Pillar;
  label: string;
  score: number | null;
  metrics: MetricResult[];
};

export type StockCategory =
  | "compounder"
  | "quality_premium"
  | "value_opportunity"
  | "turnaround"
  | "value_trap"
  | "weak"
  | "average";

export type StockRating = "strong" | "good" | "average" | "weak" | "avoid";

export type StockScorecard = {
  symbol: string;
  name: string;
  isFinancial: boolean;
  asOf: string;
  /** Latest fiscal year used. */
  fiscalYear: string | null;
  yearsOfData: number;
  pillars: PillarResult[];
  /** Weighted 0-100. */
  score: number;
  rating: StockRating;
  category: StockCategory;
  /** Key passes / failures in plain English (deterministic). */
  strengths: string[];
  concerns: string[];
  /** Coffee Can checklist on available history. */
  coffeeCan: { passed: boolean; revenueGrowthYears: string; roceYears: string; note: string };
  piotroski: number | null;
  price: number | null;
  /** Low data confidence when key fields are missing. */
  confidence: "high" | "medium" | "low";
};
