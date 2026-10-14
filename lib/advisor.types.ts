export const RISK_PROFILES = ["conservative", "moderate", "aggressive"] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

export const ADVISOR_SECTION_KEYS = ["investments", "spending", "debt", "cash", "goals"] as const;
export type AdvisorSectionKey = (typeof ADVISOR_SECTION_KEYS)[number];

export type AdvisorProfile = {
  /** Monthly take-home income; unlocks savings rate, surplus and EMI burden. */
  monthlyIncome: number | null;
  riskProfile: RiskProfile;
  age: number | null;
};

export type AdvisorScore = {
  key: "emergency" | "debt" | "diversification" | "spending" | "savings" | "goals";
  label: string;
  /** 0-100 */
  score: number;
  detail: string;
};

/** Deterministic numbers the advice is built on. The AI never computes these. */
export type AdvisorMetrics = {
  asOf: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  invested: number;
  returnsPercent: number;
  xirr: number | null;
  monthlyIncome: number | null;
  monthlySpend: number;
  monthlyEmi: number;
  monthlySurplus: number | null;
  savingsRate: number | null;
  emergencyMonths: number | null;
  emiToIncome: number | null;
  debtToAssets: number;
  allocation: Array<{ key: string; label: string; value: number; percent: number }>;
  equityPercent: number;
  stocks: {
    count: number;
    value: number;
    returnsPercent: number;
    lossMakers: number;
    topHolding: { name: string; percent: number } | null;
    best: Array<{ name: string; returnsPercent: number }>;
    worst: Array<{ name: string; returnsPercent: number }>;
  };
  funds: {
    count: number;
    value: number;
    returnsPercent: number;
    topHolding: { name: string; percent: number } | null;
    categories: Array<{ label: string; percent: number }>;
    smallCapPercent: number;
  };
  spending: {
    cycleSpent: number;
    budget: number | null;
    projected: number;
    status: string;
    previousCycleSpent: number | null;
    topCategories: Array<{ label: string; amount: number }>;
  };
  debt: Array<{ name: string; annualRate: number | null; outstanding: number; emi: number; monthsLeft: number | null }>;
  goals: Array<{ name: string; progressPct: number; status: string; requiredMonthly: number | null; targetDate: string | null }>;
  scores: AdvisorScore[];
  /** Average of the available scores, 0-100. */
  healthScore: number;
};

export type AdvisorSectionAdvice = {
  key: AdvisorSectionKey;
  status: "good" | "watch" | "act";
  summary: string;
  wins: string[];
  issues: string[];
  nextStep: string;
};

/** Structured output requested from the model. */
export type AdvisorAdvice = {
  headline: string;
  verdict: string;
  actions: Array<{ priority: number; title: string; detail: string; impact: string }>;
  moneyFlow: {
    monthlyAmount: number;
    basis: string;
    allocations: Array<{ label: string; amount: number; reason: string }>;
  };
  targetAllocation: Array<{ key: string; percent: number }>;
  sections: AdvisorSectionAdvice[];
};

export type AdvisorReport = {
  advice: AdvisorAdvice;
  model: string;
  generatedAt: string;
  /** Earliest time a manual re-analysis is allowed. */
  nextRefreshAt: string;
};
