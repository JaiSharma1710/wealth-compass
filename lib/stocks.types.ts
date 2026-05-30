export const STOCK_TRANSACTION_TYPES = ["BUY", "SELL"] as const;
export const STOCK_HOLDING_STATUSES = ["ACTIVE", "CLOSED"] as const;

export type StockTransactionType = (typeof STOCK_TRANSACTION_TYPES)[number];
export type StockHoldingStatus = (typeof STOCK_HOLDING_STATUSES)[number];

export type StockSearchResult = {
  symbol: string;
  exchange: string;
  companyName: string;
  shortName: string;
  quoteType: "EQUITY" | "ETF";
  sector: string | null;
  industry: string | null;
};

export type StockQuote = {
  symbol: string;
  exchange: string | null;
  currency: string | null;
  shortName: string | null;
  longName: string | null;
  quoteType: string | null;
  regularMarketPrice: number | null;
  regularMarketChange: number | null;
  regularMarketChangePercent: number | null;
  regularMarketPreviousClose: number | null;
  marketState: string | null;
  isMarketOpen: boolean;
  sector: string | null;
  industry: string | null;
};

export type StockChartPoint = {
  timestamp: string;
  dateLabel: string;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
};

export type StockNewsItem = {
  id: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
  relatedTickers: string[];
};

export type StockDividendItem = {
  date: string;
  amount: number;
};

export type StockSplitItem = {
  date: string;
  numerator: number | null;
  denominator: number | null;
  splitRatio: string;
};

export type StockHoldingSummary = {
  id: string;
  symbol: string;
  exchange: string;
  companyName: string;
  shortName: string;
  sector: string | null;
  industry: string | null;
  currency: string | null;
  quantity: number;
  averagePrice: number;
  investedAmount: number;
  currentPrice: number | null;
  currentValue: number;
  unrealizedProfit: number;
  unrealizedProfitPercent: number;
  realizedProfit: number;
  totalDividends: number;
  todayPnL: number | null;
  todayPnLPercent: number | null;
  allocationPercent: number;
  status: StockHoldingStatus;
  openedAt: string;
  closedAt: string | null;
  lastQuoteAt: string | null;
  isStale: boolean;
};

export type StockTransactionSummary = {
  id: string;
  holdingId: string;
  symbol: string;
  exchange: string;
  companyName: string;
  type: StockTransactionType;
  quantity: number;
  price: number;
  brokerage: number;
  taxes: number;
  charges: number;
  transactionDate: string;
  note: string;
  buyGrossAmount: number | null;
  buyCharges: number | null;
  buyNetAmount: number | null;
  averagePriceAtSellTime: number | null;
  costBasis: number | null;
  sellGrossAmount: number | null;
  sellCharges: number | null;
  sellNetAmount: number | null;
  realizedProfitForSell: number | null;
};

export type StockDistributionPoint = {
  label: string;
  value: number;
  percentage: number;
};

export type StockDashboardData = {
  totalInvestedAmount: number;
  totalCurrentValue: number;
  totalUnrealizedProfit: number;
  totalUnrealizedProfitPercent: number;
  totalRealizedProfit: number;
  totalTodayPnL: number | null;
  totalTodayPnLPercent: number | null;
  totalDividends: number;
  holdingCount: number;
  profitableHoldingsCount: number;
  lossHoldingsCount: number;
  hasStaleQuotes: boolean;
  lastUpdatedAt: string | null;
  holdings: StockHoldingSummary[];
  stockAllocation: StockDistributionPoint[];
  sectorAllocation: StockDistributionPoint[];
  topGainers: StockHoldingSummary[];
  topLosers: StockHoldingSummary[];
  transactions: StockTransactionSummary[];
};

export type StockDetailData = {
  symbol: string;
  quote: StockQuote | null;
  activeHolding: StockHoldingSummary | null;
  transactions: StockTransactionSummary[];
  chart: StockChartPoint[];
  dividends: StockDividendItem[];
  splits: StockSplitItem[];
  news: StockNewsItem[];
  insights: unknown;
  details: {
    companyName: string | null;
    shortName: string | null;
    sector: string | null;
    industry: string | null;
    currency: string | null;
    exchange: string | null;
    longBusinessSummary: string | null;
    website: string | null;
    marketCap: number | null;
    trailingPE: number | null;
    forwardPE: number | null;
    dividendYield: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
  };
  isStale: boolean;
  lastUpdatedAt: string | null;
};

export type SaveStockBuyInput = {
  symbol: string;
  exchange: string;
  companyName: string;
  shortName: string;
  sector?: string | null;
  industry?: string | null;
  currency?: string | null;
  quantity: number;
  price: number;
  brokerage?: number;
  taxes?: number;
  charges?: number;
  transactionDate: string;
  note?: string;
};

export type SaveStockSellInput = {
  symbol: string;
  quantity: number;
  price: number;
  brokerage?: number;
  taxes?: number;
  charges?: number;
  transactionDate: string;
  note?: string;
};
