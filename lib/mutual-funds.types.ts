export type MutualFundTransactionType = "buy" | "sell";

export type MutualFundMonthSummary = {
  key: string;
  label: string;
  totalInvested: number;
  totalValue: number;
};

export type MutualFundNavHistoryPoint = {
  key: string;
  label: string;
  date: string;
  nav: number;
};

export type MutualFundNavHistory = {
  schemeCode: number;
  schemeName: string;
  latestNav: number;
  changeAmount: number;
  changePct: number;
  points: MutualFundNavHistoryPoint[];
};

export type MutualFundHoldingSummary = {
  schemeCode: number;
  schemeName: string;
  units: number;
  investedAmount: number;
  averageNav: number;
  currentNav: number;
  currentValue: number;
  profitLossAmount: number;
  profitLossPct: number;
  allocationPct: number;
};

export type MutualFundOptionSummary = {
  schemeCode: number;
  schemeName: string;
};

export type MutualFundTransactionSummary = {
  id: string;
  schemeCode: number;
  schemeName: string;
  transactionType: MutualFundTransactionType;
  units: number;
  nav: number;
  amount: number;
  averageBuyNav: number | null;
  realizedProfitAmount: number | null;
  realizedProfitPct: number | null;
  date: string;
};

export type MutualFundDashboardData = {
  totalPortfolioValue: number;
  totalInvestedAmount: number;
  totalRealizedProfitAmount: number;
  totalRealizedProfitPct: number;
  totalProfitLossAmount: number;
  totalProfitLossPct: number;
  monthOverMonthChangeAmount: number;
  monthOverMonthChangePct: number;
  months: MutualFundMonthSummary[];
  distribution: MutualFundHoldingSummary[];
  topHoldings: MutualFundHoldingSummary[];
  holdings: MutualFundHoldingSummary[];
  previousFunds: MutualFundOptionSummary[];
  recentTransactions: MutualFundTransactionSummary[];
};
