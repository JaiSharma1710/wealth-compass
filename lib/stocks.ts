import "server-only";

import { Types } from "mongoose";

import {
  getDailyValueFreshness,
  getHoldingDailyValueHistory,
  getLatestHoldingValueMap,
  getPreviousHoldingValueMap,
  getTodayDateKey,
  type DailyValueRecord,
} from "@/lib/daily-values";
import { connectToDatabase } from "@/lib/mongodb";
import { StockTransaction } from "@/lib/models/stock-transaction";
import {
  calculateBuyCashFlow,
  calculateNextBuyLifecycleState,
  calculateNextSellLifecycleState,
  calculateSellSnapshot,
  roundCurrency,
  roundPercent,
} from "@/lib/stocks-calculations";
import type {
  SaveStockBuyInput,
  SaveStockSellInput,
  StockChartPoint,
  StockDashboardData,
  StockDetailData,
  StockDistributionPoint,
  StockHoldingSummary,
  StockQuote,
  StockTransactionSummary,
} from "@/lib/stocks.types";

const ACTIVE_EPSILON = 0.000001;

type StockTransactionRecord = {
  _id: Types.ObjectId | string;
  holdingId?: Types.ObjectId | string | null;
  userId: Types.ObjectId | string;
  symbol: string;
  exchange: string;
  companyName: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  brokerage: number;
  taxes: number;
  charges: number;
  note?: string;
  buyGrossAmount?: number | null;
  buyCharges?: number | null;
  buyNetAmount?: number | null;
  averagePriceAtSellTime?: number | null;
  costBasis?: number | null;
  sellGrossAmount?: number | null;
  sellCharges?: number | null;
  sellNetAmount?: number | null;
  realizedProfitForSell?: number | null;
  transactionDate: Date;
  createdAt?: Date;
};

export type StockPositionForValuation = {
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
  openedAt: Date;
};

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeNote(value?: string) {
  return String(value || "").trim();
}

function normalizeTransaction(record: StockTransactionRecord): StockTransactionSummary {
  return {
    id: String(record._id),
    holdingId: record.holdingId ? String(record.holdingId) : "",
    symbol: record.symbol,
    exchange: record.exchange,
    companyName: record.companyName,
    type: record.type,
    quantity: record.quantity,
    price: record.price,
    brokerage: record.brokerage,
    taxes: record.taxes,
    charges: record.charges,
    transactionDate: record.transactionDate.toISOString(),
    note: record.note || "",
    buyGrossAmount: record.buyGrossAmount ?? null,
    buyCharges: record.buyCharges ?? null,
    buyNetAmount: record.buyNetAmount ?? null,
    averagePriceAtSellTime: record.averagePriceAtSellTime ?? null,
    costBasis: record.costBasis ?? null,
    sellGrossAmount: record.sellGrossAmount ?? null,
    sellCharges: record.sellCharges ?? null,
    sellNetAmount: record.sellNetAmount ?? null,
    realizedProfitForSell: record.realizedProfitForSell ?? null,
  };
}

function ensurePositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function ensurePositiveNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
}

function ensureNonNegativeNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be greater than or equal to 0.`);
  }
}

function validateBuyInput(input: SaveStockBuyInput) {
  if (!input.symbol.trim()) {
    throw new Error("Symbol is required.");
  }

  if (!input.exchange.trim()) {
    throw new Error("Exchange is required.");
  }

  if (!input.companyName.trim()) {
    throw new Error("Company name is required.");
  }

  ensurePositiveInteger(input.quantity, "BUY quantity");
  ensurePositiveNumber(input.price, "Buy price");
  ensureNonNegativeNumber(input.brokerage || 0, "Brokerage");
  ensureNonNegativeNumber(input.taxes || 0, "Taxes");
  ensureNonNegativeNumber(input.charges || 0, "Charges");

  if (!parseDateOnly(input.transactionDate)) {
    throw new Error("Transaction date is required.");
  }
}

function validateSellInput(input: SaveStockSellInput) {
  if (!input.symbol.trim()) {
    throw new Error("Symbol is required.");
  }

  ensurePositiveInteger(input.quantity, "SELL quantity");
  ensurePositiveNumber(input.price, "Sell price");
  ensureNonNegativeNumber(input.brokerage || 0, "Brokerage");
  ensureNonNegativeNumber(input.taxes || 0, "Taxes");
  ensureNonNegativeNumber(input.charges || 0, "Charges");

  if (!parseDateOnly(input.transactionDate)) {
    throw new Error("Transaction date is required.");
  }
}

function sortTransactionsAscending(transactions: StockTransactionRecord[]) {
  return [...transactions].sort((left, right) => {
    const byDate =
      new Date(left.transactionDate).getTime() - new Date(right.transactionDate).getTime();

    if (byDate !== 0) {
      return byDate;
    }

    return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
  });
}

async function loadTransactions(userId: string, symbol?: string) {
  await connectToDatabase();

  return (await StockTransaction.find({
    userId,
    ...(symbol ? { symbol } : {}),
  })
    .sort({ transactionDate: 1, createdAt: 1 })
    .lean()) as StockTransactionRecord[];
}

function buildPositionsFromTransactions(transactions: StockTransactionRecord[]) {
  const positions = new Map<string, StockPositionForValuation>();

  for (const transaction of sortTransactionsAscending(transactions)) {
    const symbol = transaction.symbol;
    const current = positions.get(symbol);

    if (transaction.type === "BUY") {
      const next = calculateNextBuyLifecycleState({
        currentQuantity: current?.quantity || 0,
        currentAveragePrice: current?.averagePrice || 0,
        buyQuantity: transaction.quantity,
        buyPrice: transaction.price,
      });

      positions.set(symbol, {
        symbol,
        exchange: transaction.exchange,
        companyName: transaction.companyName,
        shortName: symbol,
        sector: null,
        industry: null,
        currency: null,
        quantity: next.quantity,
        averagePrice: next.averagePrice,
        investedAmount: next.investedAmount,
        openedAt: current?.openedAt || transaction.transactionDate,
      });
      continue;
    }

    if (!current || transaction.quantity > current.quantity) {
      continue;
    }

    const next = calculateNextSellLifecycleState({
      currentQuantity: current.quantity,
      currentAveragePrice: current.averagePrice,
      sellQuantity: transaction.quantity,
    });

    if (next.remainingQuantity <= ACTIVE_EPSILON) {
      positions.delete(symbol);
      continue;
    }

    positions.set(symbol, {
      ...current,
      quantity: next.remainingQuantity,
      averagePrice: next.averagePrice,
      investedAmount: next.investedAmount,
    });
  }

  return [...positions.values()].sort((left, right) => right.investedAmount - left.investedAmount);
}

function buildDistribution(entries: Array<{ label: string; value: number }>): StockDistributionPoint[] {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);

  return entries
    .filter((entry) => entry.value > 0)
    .map((entry) => ({
      label: entry.label,
      value: roundCurrency(entry.value),
      percentage: total > 0 ? roundPercent((entry.value / total) * 100) : 0,
    }))
    .sort((left, right) => right.value - left.value);
}

function buildQuoteFromDailyValue(
  position: StockPositionForValuation,
  value: DailyValueRecord | null
): StockQuote {
  return {
    symbol: position.symbol,
    exchange: position.exchange,
    currency: position.currency,
    shortName: position.shortName,
    longName: position.companyName,
    quoteType: null,
    regularMarketPrice: value?.priceOrNav ?? null,
    regularMarketChange: null,
    regularMarketChangePercent: null,
    regularMarketPreviousClose: null,
    marketState: null,
    isMarketOpen: false,
    sector: position.sector,
    industry: position.industry,
  };
}

function buildHoldingSummary(input: {
  position: StockPositionForValuation;
  value: DailyValueRecord | null;
  previousValue: DailyValueRecord | null;
  totalCurrentValue: number;
  todayDate: string;
}): StockHoldingSummary {
  const currentPrice = input.value?.priceOrNav ?? null;
  const currentValue =
    currentPrice == null ? 0 : roundCurrency(currentPrice * input.position.quantity);
  const unrealizedProfit = roundCurrency(currentValue - input.position.investedAmount);
  const unrealizedProfitPercent =
    input.position.investedAmount > 0
      ? roundPercent((unrealizedProfit / input.position.investedAmount) * 100)
      : 0;
  const { isStale, lastSyncedAt } = getDailyValueFreshness(input.value, input.todayDate);
  const todayPnL =
    input.value && input.value.date === input.todayDate && input.previousValue
      ? roundCurrency(currentValue - input.previousValue.currentValue)
      : null;
  const todayPnLPercent =
    todayPnL != null && currentValue - todayPnL > 0
      ? roundPercent((todayPnL / (currentValue - todayPnL)) * 100)
      : null;

  return {
    id: input.position.symbol,
    symbol: input.position.symbol,
    exchange: input.position.exchange,
    companyName: input.position.companyName,
    shortName: input.position.shortName || input.position.companyName,
    sector: input.position.sector,
    industry: input.position.industry,
    currency: input.position.currency,
    quantity: input.position.quantity,
    averagePrice: input.position.averagePrice,
    investedAmount: input.position.investedAmount,
    currentPrice,
    currentValue,
    unrealizedProfit,
    unrealizedProfitPercent,
    realizedProfit: 0,
    totalDividends: 0,
    todayPnL,
    todayPnLPercent,
    allocationPercent:
      input.totalCurrentValue > 0
        ? roundPercent((currentValue / input.totalCurrentValue) * 100)
        : 0,
    status: "ACTIVE",
    openedAt: input.position.openedAt.toISOString(),
    closedAt: null,
    lastQuoteAt: lastSyncedAt,
    isStale,
  };
}

export async function getActiveStockPositions(userId: string) {
  const transactions = await loadTransactions(userId);
  return buildPositionsFromTransactions(transactions);
}

export async function saveStockBuyTransaction(userId: string, input: SaveStockBuyInput) {
  validateBuyInput(input);
  const transactionDate = parseDateOnly(input.transactionDate);

  if (!transactionDate) {
    throw new Error("Transaction date is required.");
  }

  await connectToDatabase();

  const cashFlow = calculateBuyCashFlow({
    quantity: input.quantity,
    price: input.price,
    brokerage: input.brokerage,
    taxes: input.taxes,
    charges: input.charges,
  });

  await StockTransaction.create({
    userId,
    holdingId: null,
    symbol: input.symbol.trim().toUpperCase(),
    exchange: input.exchange.trim(),
    companyName: input.companyName.trim(),
    type: "BUY",
    quantity: input.quantity,
    price: input.price,
    brokerage: input.brokerage || 0,
    taxes: input.taxes || 0,
    charges: input.charges || 0,
    note: normalizeNote(input.note),
    buyGrossAmount: cashFlow.buyGrossAmount,
    buyCharges: cashFlow.buyCharges,
    buyNetAmount: cashFlow.buyNetAmount,
    transactionDate,
  });
}

export async function saveStockSellTransaction(userId: string, input: SaveStockSellInput) {
  validateSellInput(input);
  const transactionDate = parseDateOnly(input.transactionDate);

  if (!transactionDate) {
    throw new Error("Transaction date is required.");
  }

  const transactions = await loadTransactions(userId);
  const holding = buildPositionsFromTransactions(transactions).find(
    (position) => position.symbol === input.symbol.trim().toUpperCase()
  );

  if (!holding) {
    throw new Error("No active holding found for this symbol.");
  }

  if (input.quantity > holding.quantity) {
    throw new Error("SELL quantity cannot exceed current active holding quantity.");
  }

  const snapshot = calculateSellSnapshot({
    averagePriceAtSellTime: holding.averagePrice,
    quantity: input.quantity,
    price: input.price,
    brokerage: input.brokerage,
    taxes: input.taxes,
    charges: input.charges,
  });

  await connectToDatabase();

  await StockTransaction.create({
    userId,
    holdingId: null,
    symbol: holding.symbol,
    exchange: holding.exchange,
    companyName: holding.companyName,
    type: "SELL",
    quantity: input.quantity,
    price: input.price,
    brokerage: input.brokerage || 0,
    taxes: input.taxes || 0,
    charges: input.charges || 0,
    note: normalizeNote(input.note),
    averagePriceAtSellTime: snapshot.averagePriceAtSellTime,
    costBasis: snapshot.costBasis,
    sellGrossAmount: snapshot.sellGrossAmount,
    sellCharges: snapshot.sellCharges,
    sellNetAmount: snapshot.sellNetAmount,
    realizedProfitForSell: snapshot.realizedProfitForSell,
    transactionDate,
  });
}

export async function getStockDashboard(userId: string): Promise<StockDashboardData> {
  const transactions = await loadTransactions(userId);
  const positions = buildPositionsFromTransactions(transactions);
  const symbols = positions.map((position) => position.symbol);
  const todayDate = getTodayDateKey();
  const [valueMap, previousValueMap] = await Promise.all([
    getLatestHoldingValueMap(userId, "stock", symbols),
    getPreviousHoldingValueMap(userId, "stock", symbols, todayDate),
  ]);
  const totalCurrentValue = roundCurrency(
    positions.reduce((sum, position) => {
      const price = valueMap.get(position.symbol)?.priceOrNav ?? null;
      return sum + (price == null ? 0 : price * position.quantity);
    }, 0)
  );
  const holdings = positions
    .map((position) =>
      buildHoldingSummary({
        position,
        value: valueMap.get(position.symbol) || null,
        previousValue: previousValueMap.get(position.symbol) || null,
        totalCurrentValue,
        todayDate,
      })
    )
    .sort((left, right) => right.currentValue - left.currentValue);
  const totalInvestedAmount = roundCurrency(
    holdings.reduce((sum, holding) => sum + holding.investedAmount, 0)
  );
  const totalUnrealizedProfit = roundCurrency(
    holdings.reduce((sum, holding) => sum + holding.unrealizedProfit, 0)
  );
  const totalUnrealizedProfitPercent =
    totalInvestedAmount > 0
      ? roundPercent((totalUnrealizedProfit / totalInvestedAmount) * 100)
      : 0;
  const totalRealizedProfit = roundCurrency(
    transactions.reduce((sum, transaction) => sum + (transaction.realizedProfitForSell || 0), 0)
  );
  const totalTodayPnLRaw = holdings.reduce((sum, holding) => sum + (holding.todayPnL || 0), 0);
  const hasAnyTodayPnL = holdings.some((holding) => holding.todayPnL != null);
  const totalTodayPnL = hasAnyTodayPnL ? roundCurrency(totalTodayPnLRaw) : null;
  const totalTodayPnLPercent =
    totalTodayPnL != null && totalCurrentValue - totalTodayPnL > 0
      ? roundPercent((totalTodayPnL / (totalCurrentValue - totalTodayPnL)) * 100)
      : null;
  const stockAllocation = buildDistribution(
    holdings.map((holding) => ({ label: holding.symbol, value: holding.currentValue }))
  );
  const sectorAllocation = buildDistribution(
    holdings.map((holding) => ({
      label: holding.sector || "Unclassified",
      value: holding.currentValue,
    }))
  );
  const lastUpdatedAt =
    holdings
      .map((holding) => holding.lastQuoteAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) || null;

  return {
    totalInvestedAmount,
    totalCurrentValue,
    totalUnrealizedProfit,
    totalUnrealizedProfitPercent,
    totalRealizedProfit,
    totalTodayPnL,
    totalTodayPnLPercent,
    totalDividends: 0,
    holdingCount: holdings.length,
    profitableHoldingsCount: holdings.filter((holding) => holding.unrealizedProfit >= 0).length,
    lossHoldingsCount: holdings.filter((holding) => holding.unrealizedProfit < 0).length,
    hasStaleQuotes: holdings.some((holding) => holding.isStale),
    lastUpdatedAt,
    holdings,
    stockAllocation,
    sectorAllocation,
    topGainers: [...holdings]
      .sort((a, b) => b.unrealizedProfitPercent - a.unrealizedProfitPercent)
      .slice(0, 5),
    topLosers: [...holdings]
      .sort((a, b) => a.unrealizedProfitPercent - b.unrealizedProfitPercent)
      .slice(0, 5),
    transactions: [...transactions].reverse().map(normalizeTransaction),
  };
}

export async function getStockTransactions(userId: string, symbol?: string) {
  const transactions = await loadTransactions(userId, symbol);
  return [...transactions].reverse().map(normalizeTransaction);
}

function mapDailyValuesToChart(values: DailyValueRecord[]): StockChartPoint[] {
  return values.map((value) => ({
    timestamp: value.syncedAt,
    dateLabel: new Date(`${value.date}T00:00:00`).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    }),
    close: value.priceOrNav || 0,
    open: null,
    high: null,
    low: null,
    volume: null,
  }));
}

export async function getStockDetail(userId: string, symbol: string): Promise<StockDetailData> {
  const normalizedSymbol = decodeURIComponent(symbol).trim().toUpperCase();
  const [dashboard, transactions, chartValues] = await Promise.all([
    getStockDashboard(userId),
    getStockTransactions(userId, normalizedSymbol),
    getHoldingDailyValueHistory({
      userId,
      assetType: "stock",
      assetKey: normalizedSymbol,
      limit: 370,
    }),
  ]);
  const activeHolding =
    dashboard.holdings.find((holding) => holding.symbol === normalizedSymbol) || null;
  const latestValue = chartValues.at(-1) || null;
  const quote = activeHolding
    ? buildQuoteFromDailyValue(
        {
          symbol: activeHolding.symbol,
          exchange: activeHolding.exchange,
          companyName: activeHolding.companyName,
          shortName: activeHolding.shortName,
          sector: activeHolding.sector,
          industry: activeHolding.industry,
          currency: activeHolding.currency,
          quantity: activeHolding.quantity,
          averagePrice: activeHolding.averagePrice,
          investedAmount: activeHolding.investedAmount,
          openedAt: new Date(activeHolding.openedAt),
        },
        latestValue
      )
    : null;

  return {
    symbol: normalizedSymbol,
    quote,
    activeHolding,
    transactions,
    chart: mapDailyValuesToChart(chartValues),
    dividends: [],
    splits: [],
    news: [],
    insights: null,
    details: {
      companyName: activeHolding?.companyName || null,
      shortName: activeHolding?.shortName || null,
      sector: activeHolding?.sector || null,
      industry: activeHolding?.industry || null,
      currency: activeHolding?.currency || null,
      exchange: activeHolding?.exchange || null,
      longBusinessSummary: null,
      website: null,
      marketCap: null,
      trailingPE: null,
      forwardPE: null,
      dividendYield: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
    },
    isStale: activeHolding?.isStale ?? true,
    lastUpdatedAt: activeHolding?.lastQuoteAt || null,
  };
}

export async function getActiveHoldingSymbols(userId: string) {
  const positions = await getActiveStockPositions(userId);

  return positions.map((position) => ({
    symbol: position.symbol,
    companyName: position.companyName,
  }));
}

export async function validateActiveHoldingSymbol(userId: string, symbol: string) {
  const positions = await getActiveStockPositions(userId);
  return positions.some((position) => position.symbol === symbol.trim().toUpperCase());
}
