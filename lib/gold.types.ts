import type { CashFlowPoint } from "@/lib/stocks.types";

export const GOLD_INVESTMENT_OPTIONS = [
  { label: "Sovereign Gold Bonds", value: "sovereign_gold_bond" },
  { label: "Gold ETFs", value: "gold_etf" },
  { label: "Gold Mutual Funds", value: "gold_mutual_fund" },
  { label: "Digital Gold", value: "digital_gold" },
  { label: "Physical Gold", value: "physical_gold" },
] as const;

export type GoldInvestmentOption = (typeof GOLD_INVESTMENT_OPTIONS)[number]["value"];

export type GoldTransactionType = "buy" | "sell" | "valuation";

export type GoldMonthSummary = {
  key: string;
  label: string;
  totalInvested: number;
  totalValue: number;
};

export type GoldHoldingSummary = {
  id: string;
  investmentOption: GoldInvestmentOption;
  investmentOptionLabel: string;
  schemeName: string;
  units: number | null;
  investedAmount: number;
  currentValue: number;
  profitLossAmount: number;
  profitLossPct: number;
  /** Date (ISO) of the latest buy or valuation entry for this holding. */
  lastValuedAt?: string | null;
};

export type GoldValuePoint = {
  date: string;
  /** Total gold value on that day (each holding carries its last known value forward). */
  totalValue: number;
  totalInvested: number;
};

export type GoldTrackerInfo = {
  holdingId: string;
  symbol: string;
  units: number;
  lastPrice: number | null;
  lastSyncedAt: string | null;
  lastError: string;
};

export type GoldOptionDistribution = {
  investmentOption: GoldInvestmentOption;
  investmentOptionLabel: string;
  currentValue: number;
  percentage: number;
};

export type GoldActivitySummary = {
  id: string;
  date: string;
  transactionType: GoldTransactionType;
  investmentOption: GoldInvestmentOption;
  investmentOptionLabel: string;
  schemeName: string;
  units: number | null;
  investedAmount: number | null;
  currentValue: number | null;
  sellAmount: number | null;
  realizedProfitAmount: number | null;
};

export type GoldRecentActivityPage = {
  entries: GoldActivitySummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type GoldDashboardData = {
  totalCurrentValue: number;
  totalInvestedAmount: number;
  totalProfitLossAmount: number;
  totalProfitLossPct: number;
  monthOverMonthChangeAmount: number;
  monthOverMonthChangePct: number;
  months: GoldMonthSummary[];
  holdings: GoldHoldingSummary[];
  optionDistribution: GoldOptionDistribution[];
  recentActivity: GoldRecentActivityPage;
  xirr: number | null;
  cashFlows: CashFlowPoint[];
  /** Up to 500 latest entries (buys, sells, valuations), newest first. */
  allActivity?: GoldActivitySummary[];
  /** Daily total value series built from buys, sells and valuation entries. */
  valueHistory?: GoldValuePoint[];
  /** Change between the two most recent days in valueHistory (null if fewer than two). */
  lastDayChange?: { amount: number; pct: number | null; fromDate: string; toDate: string } | null;
  lastValuedAt?: string | null;
};
