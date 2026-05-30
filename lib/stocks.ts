import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/mongodb";
import { StockHolding } from "@/lib/models/stock-holding";
import { StockTransaction } from "@/lib/models/stock-transaction";
import {
  calculateAverageStockPrice,
  calculateBuyCashFlow,
  calculateHoldingMetrics,
  calculateNextBuyLifecycleState,
  calculateNextSellLifecycleState,
  calculateSellSnapshot,
  calculateTodayPnL,
  calculateTodayPnLPercent,
  roundCurrency,
  roundPercent,
} from "@/lib/stocks-calculations";
import { getBulkQuotes, getStockDetails, getStockChart, getDividendHistory, getStockInsights, getStockNews, getSplitHistory } from "@/lib/services/yahoo-finance.service";
import type {
  SaveStockBuyInput,
  SaveStockSellInput,
  StockDashboardData,
  StockDetailData,
  StockHoldingSummary,
  StockQuote,
  StockTransactionSummary,
} from "@/lib/stocks.types";

type StockHoldingRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  symbol: string;
  exchange: string;
  companyName: string;
  shortName?: string | null;
  sector?: string | null;
  industry?: string | null;
  currency?: string | null;
  quantity: number;
  averagePrice: number;
  investedAmount: number;
  currentPrice?: number | null;
  currentValue: number;
  unrealizedProfit: number;
  unrealizedProfitPercent: number;
  realizedProfit: number;
  totalDividends: number;
  status: "ACTIVE" | "CLOSED";
  openedAt: Date;
  closedAt?: Date | null;
  lastQuoteAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type StockTransactionRecord = {
  _id: Types.ObjectId | string;
  holdingId: Types.ObjectId | string;
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

type QuoteRefreshResult = {
  quoteMap: Record<string, StockQuote | null>;
  staleSymbols: Set<string>;
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

function normalizeHoldingId(value: Types.ObjectId | string) {
  return String(value);
}

function normalizeTransaction(record: StockTransactionRecord): StockTransactionSummary {
  return {
    id: String(record._id),
    holdingId: normalizeHoldingId(record.holdingId),
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

async function loadActiveHolding(userId: string, symbol: string) {
  await connectToDatabase();

  return (await StockHolding.findOne({
    userId,
    symbol,
    status: "ACTIVE",
  })) as unknown as StockHoldingRecord | null;
}

async function recomputeHoldingRealizedProfit(holdingId: string) {
  const result = await StockTransaction.aggregate<{ total: number }>([
    {
      $match: {
        holdingId: new Types.ObjectId(holdingId),
        type: "SELL",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$realizedProfitForSell" },
      },
    },
  ]);

  return roundCurrency(result[0]?.total || 0);
}

async function refreshActiveHoldingQuotes(holdings: StockHoldingRecord[]): Promise<QuoteRefreshResult> {
  const symbols = [...new Set(holdings.map((holding) => holding.symbol))];

  if (!symbols.length) {
    return { quoteMap: {}, staleSymbols: new Set<string>() };
  }

  let quoteMap: Record<string, StockQuote | null> = {};
  const staleSymbols = new Set<string>();

  try {
    quoteMap = await getBulkQuotes(symbols);
  } catch {
    for (const symbol of symbols) {
      staleSymbols.add(symbol);
    }

    return { quoteMap: {}, staleSymbols };
  }

  await Promise.all(
    holdings.map(async (holding) => {
      const quote = quoteMap[holding.symbol];
      const currentPrice = quote?.regularMarketPrice ?? holding.currentPrice ?? null;
      const isStale = quote?.regularMarketPrice == null;

      if (isStale) {
        staleSymbols.add(holding.symbol);
      }

      const metrics = calculateHoldingMetrics({
        quantity: holding.quantity,
        averagePrice: holding.averagePrice,
        currentPrice,
      });

      await StockHolding.updateOne(
        { _id: holding._id },
        {
          $set: {
            currentPrice,
            currentValue: metrics.currentValue,
            unrealizedProfit: metrics.unrealizedProfit,
            unrealizedProfitPercent: metrics.unrealizedProfitPercent,
            ...(isStale ? {} : { lastQuoteAt: new Date() }),
          },
        }
      );

      holding.currentPrice = currentPrice;
      holding.currentValue = metrics.currentValue;
      holding.unrealizedProfit = metrics.unrealizedProfit;
      holding.unrealizedProfitPercent = metrics.unrealizedProfitPercent;
      holding.lastQuoteAt = isStale ? holding.lastQuoteAt || null : new Date();
    })
  );

  return { quoteMap, staleSymbols };
}

function buildHoldingSummary(
  holding: StockHoldingRecord,
  quote: StockQuote | null,
  totalCurrentValue: number,
  staleSymbols: Set<string>
): StockHoldingSummary {
  const currentPrice = quote?.regularMarketPrice ?? holding.currentPrice ?? null;
  const currentValue = currentPrice == null ? 0 : roundCurrency(currentPrice * holding.quantity);
  const unrealizedProfit = roundCurrency(currentValue - holding.investedAmount);
  const unrealizedProfitPercent =
    holding.investedAmount > 0
      ? roundPercent((unrealizedProfit / holding.investedAmount) * 100)
      : 0;
  const todayPnL = calculateTodayPnL({
    quantity: holding.quantity,
    regularMarketChange: quote?.regularMarketChange,
    currentPrice,
    regularMarketPreviousClose: quote?.regularMarketPreviousClose,
  });
  const todayPnLPercent = calculateTodayPnLPercent(todayPnL, currentValue);

  return {
    id: String(holding._id),
    symbol: holding.symbol,
    exchange: holding.exchange,
    companyName: holding.companyName,
    shortName: holding.shortName || holding.companyName,
    sector: holding.sector || null,
    industry: holding.industry || null,
    currency: holding.currency || quote?.currency || null,
    quantity: holding.quantity,
    averagePrice: holding.averagePrice,
    investedAmount: holding.investedAmount,
    currentPrice,
    currentValue,
    unrealizedProfit,
    unrealizedProfitPercent,
    realizedProfit: holding.realizedProfit,
    totalDividends: holding.totalDividends,
    todayPnL,
    todayPnLPercent,
    allocationPercent: totalCurrentValue > 0 ? roundPercent((currentValue / totalCurrentValue) * 100) : 0,
    status: holding.status,
    openedAt: holding.openedAt.toISOString(),
    closedAt: holding.closedAt?.toISOString() || null,
    lastQuoteAt: holding.lastQuoteAt?.toISOString() || null,
    isStale: staleSymbols.has(holding.symbol),
  };
}

function buildDistribution(entries: Array<{ label: string; value: number }>) {
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

async function loadTransactions(userId: string, symbol?: string) {
  await connectToDatabase();

  return (await StockTransaction.find({
    userId,
    ...(symbol ? { symbol } : {}),
  })
    .sort({ transactionDate: -1, createdAt: -1 })
    .lean()) as StockTransactionRecord[];
}

export async function saveStockBuyTransaction(userId: string, input: SaveStockBuyInput) {
  validateBuyInput(input);
  const transactionDate = parseDateOnly(input.transactionDate);

  if (!transactionDate) {
    throw new Error("Transaction date is required.");
  }

  await connectToDatabase();

  let holding = await loadActiveHolding(userId, input.symbol);

  if (!holding) {
    const metrics = calculateHoldingMetrics({
      quantity: input.quantity,
      averagePrice: input.price,
      currentPrice: null,
    });

    const createdHolding = await StockHolding.create({
      userId,
      symbol: input.symbol,
      exchange: input.exchange,
      companyName: input.companyName,
      shortName: input.shortName,
      sector: input.sector || null,
      industry: input.industry || null,
      currency: input.currency || null,
      quantity: input.quantity,
      averagePrice: input.price,
      investedAmount: metrics.investedAmount,
      currentPrice: null,
      currentValue: 0,
      unrealizedProfit: -metrics.investedAmount,
      unrealizedProfitPercent: -100,
      realizedProfit: 0,
      totalDividends: 0,
      status: "ACTIVE",
      openedAt: transactionDate,
      closedAt: null,
      lastQuoteAt: null,
    });

    holding = createdHolding.toObject() as StockHoldingRecord;
  } else {
    const nextState = calculateNextBuyLifecycleState({
      currentQuantity: holding.quantity,
      currentAveragePrice: holding.averagePrice,
      buyQuantity: input.quantity,
      buyPrice: input.price,
    });
    const metrics = calculateHoldingMetrics({
      quantity: nextState.quantity,
      averagePrice: nextState.averagePrice,
      currentPrice: holding.currentPrice ?? null,
    });

    await StockHolding.updateOne(
      { _id: holding._id },
      {
        $set: {
          exchange: input.exchange,
          companyName: input.companyName,
          shortName: input.shortName,
          sector: input.sector || holding.sector || null,
          industry: input.industry || holding.industry || null,
          currency: input.currency || holding.currency || null,
          quantity: nextState.quantity,
          averagePrice: nextState.averagePrice,
          investedAmount: nextState.investedAmount,
          currentValue: metrics.currentValue,
          unrealizedProfit: metrics.unrealizedProfit,
          unrealizedProfitPercent: metrics.unrealizedProfitPercent,
          status: "ACTIVE",
          closedAt: null,
        },
      }
    );
  }

  const cashFlow = calculateBuyCashFlow({
    quantity: input.quantity,
    price: input.price,
    brokerage: input.brokerage,
    taxes: input.taxes,
    charges: input.charges,
  });

  await StockTransaction.create({
    userId,
    holdingId: holding._id,
    symbol: input.symbol,
    exchange: input.exchange,
    companyName: input.companyName,
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

  await connectToDatabase();
  const holding = await loadActiveHolding(userId, input.symbol);

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
  const nextState = calculateNextSellLifecycleState({
    currentQuantity: holding.quantity,
    currentAveragePrice: holding.averagePrice,
    sellQuantity: input.quantity,
  });
  const nextMetrics = calculateHoldingMetrics({
    quantity: nextState.remainingQuantity,
    averagePrice: nextState.averagePrice,
    currentPrice: holding.currentPrice ?? null,
  });

  await StockTransaction.create({
    userId,
    holdingId: holding._id,
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

  const realizedProfit = await recomputeHoldingRealizedProfit(String(holding._id));

  if (nextState.remainingQuantity === 0) {
    await StockHolding.updateOne(
      { _id: holding._id },
      {
        $set: {
          quantity: 0,
          investedAmount: 0,
          currentValue: 0,
          unrealizedProfit: 0,
          unrealizedProfitPercent: 0,
          realizedProfit,
          status: "CLOSED",
          closedAt: transactionDate,
        },
      }
    );

    return;
  }

  await StockHolding.updateOne(
    { _id: holding._id },
    {
      $set: {
        quantity: nextState.remainingQuantity,
        averagePrice: nextState.averagePrice,
        investedAmount: nextState.investedAmount,
        currentValue: nextMetrics.currentValue,
        unrealizedProfit: nextMetrics.unrealizedProfit,
        unrealizedProfitPercent: nextMetrics.unrealizedProfitPercent,
        realizedProfit,
      },
    }
  );
}

export async function getStockDashboard(userId: string): Promise<StockDashboardData> {
  await connectToDatabase();

  const [activeHoldings, allTransactions] = await Promise.all([
    StockHolding.find({ userId, status: "ACTIVE" })
      .sort({ updatedAt: -1 })
      .lean() as Promise<StockHoldingRecord[]>,
    loadTransactions(userId),
  ]);

  const { quoteMap, staleSymbols } = await refreshActiveHoldingQuotes(activeHoldings);
  const totalCurrentValue = roundCurrency(
    activeHoldings.reduce((sum, holding) => {
      const currentPrice = quoteMap[holding.symbol]?.regularMarketPrice ?? holding.currentPrice ?? null;
      return sum + (currentPrice == null ? 0 : currentPrice * holding.quantity);
    }, 0)
  );

  const holdings = activeHoldings
    .map((holding) => buildHoldingSummary(holding, quoteMap[holding.symbol] || null, totalCurrentValue, staleSymbols))
    .sort((left, right) => right.currentValue - left.currentValue);

  const totalInvestedAmount = roundCurrency(holdings.reduce((sum, holding) => sum + holding.investedAmount, 0));
  const totalUnrealizedProfit = roundCurrency(holdings.reduce((sum, holding) => sum + holding.unrealizedProfit, 0));
  const totalRealizedProfit = roundCurrency(
    allTransactions.reduce((sum, transaction) => sum + (transaction.realizedProfitForSell || 0), 0)
  );
  const totalTodayPnLRaw = holdings.reduce((sum, holding) => sum + (holding.todayPnL || 0), 0);
  const hasAnyTodayPnL = holdings.some((holding) => holding.todayPnL != null);
  const totalTodayPnL = hasAnyTodayPnL ? roundCurrency(totalTodayPnLRaw) : null;
  const totalTodayPnLPercent =
    totalTodayPnL != null && totalCurrentValue - totalTodayPnL > 0
      ? roundPercent((totalTodayPnL / (totalCurrentValue - totalTodayPnL)) * 100)
      : null;
  const totalDividends = roundCurrency(holdings.reduce((sum, holding) => sum + holding.totalDividends, 0));
  const totalUnrealizedProfitPercent =
    totalInvestedAmount > 0 ? roundPercent((totalUnrealizedProfit / totalInvestedAmount) * 100) : 0;

  const stockAllocation = buildDistribution(
    holdings.map((holding) => ({ label: holding.symbol, value: holding.currentValue }))
  );
  const sectorTotals = new Map<string, number>();

  for (const holding of holdings) {
    const label = holding.sector || "Unclassified";
    sectorTotals.set(label, (sectorTotals.get(label) || 0) + holding.currentValue);
  }

  const sectorAllocation = buildDistribution(
    [...sectorTotals.entries()].map(([label, value]) => ({ label, value }))
  );
  const lastUpdatedAt = holdings
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
    totalDividends,
    holdingCount: holdings.length,
    profitableHoldingsCount: holdings.filter((holding) => holding.unrealizedProfit >= 0).length,
    lossHoldingsCount: holdings.filter((holding) => holding.unrealizedProfit < 0).length,
    hasStaleQuotes: staleSymbols.size > 0,
    lastUpdatedAt,
    holdings,
    stockAllocation,
    sectorAllocation,
    topGainers: [...holdings].sort((a, b) => b.unrealizedProfitPercent - a.unrealizedProfitPercent).slice(0, 5),
    topLosers: [...holdings].sort((a, b) => a.unrealizedProfitPercent - b.unrealizedProfitPercent).slice(0, 5),
    transactions: allTransactions.map(normalizeTransaction),
  };
}

export async function getStockTransactions(userId: string, symbol?: string) {
  const transactions = await loadTransactions(userId, symbol);
  return transactions.map(normalizeTransaction);
}

export async function getStockDetail(userId: string, symbol: string): Promise<StockDetailData> {
  await connectToDatabase();

  const [activeHoldingRecord, transactions, detailsResult, chart, dividends, splits, news, insights] =
    await Promise.all([
      StockHolding.findOne({ userId, symbol, status: "ACTIVE" }).lean() as Promise<StockHoldingRecord | null>,
      getStockTransactions(userId, symbol),
      getStockDetails(symbol).catch(() => null),
      getStockChart(symbol, "1mo").catch(() => []),
      getDividendHistory(symbol).catch(() => []),
      getSplitHistory(symbol).catch(() => []),
      getStockNews(symbol).catch(() => []),
      getStockInsights(symbol).catch(() => null),
    ]);

  const activeHolding = activeHoldingRecord
    ? buildHoldingSummary(activeHoldingRecord, null, activeHoldingRecord.currentValue || 0, new Set())
    : null;
  const quote = activeHoldingRecord
    ? {
        symbol,
        exchange: activeHoldingRecord.exchange,
        currency: activeHoldingRecord.currency || null,
        shortName: activeHoldingRecord.shortName || null,
        longName: activeHoldingRecord.companyName,
        quoteType: null,
        regularMarketPrice: activeHoldingRecord.currentPrice ?? null,
        regularMarketChange: null,
        regularMarketChangePercent: null,
        regularMarketPreviousClose: null,
        marketState: null,
        isMarketOpen: false,
        sector: activeHoldingRecord.sector || null,
        industry: activeHoldingRecord.industry || null,
      }
    : null;

  return {
    symbol,
    quote,
    activeHolding,
    transactions,
    chart,
    dividends,
    splits,
    news,
    insights,
    details: {
      companyName:
        detailsResult?.price?.longName ||
        detailsResult?.price?.shortName ||
        activeHoldingRecord?.companyName ||
        null,
      shortName:
        detailsResult?.price?.shortName ||
        activeHoldingRecord?.shortName ||
        null,
      sector:
        detailsResult?.summaryProfile?.sector ||
        activeHoldingRecord?.sector ||
        null,
      industry:
        detailsResult?.summaryProfile?.industry ||
        activeHoldingRecord?.industry ||
        null,
      currency:
        detailsResult?.price?.currency ||
        activeHoldingRecord?.currency ||
        null,
      exchange:
        detailsResult?.price?.exchangeName ||
        activeHoldingRecord?.exchange ||
        null,
      longBusinessSummary: detailsResult?.summaryProfile?.longBusinessSummary || null,
      website: detailsResult?.summaryProfile?.website || null,
      marketCap:
        typeof detailsResult?.price?.marketCap === "number" ? detailsResult.price.marketCap : null,
      trailingPE:
        typeof detailsResult?.summaryDetail?.trailingPE === "number"
          ? detailsResult.summaryDetail.trailingPE
          : null,
      forwardPE:
        typeof detailsResult?.summaryDetail?.forwardPE === "number"
          ? detailsResult.summaryDetail.forwardPE
          : null,
      dividendYield:
        typeof detailsResult?.summaryDetail?.dividendYield === "number"
          ? detailsResult.summaryDetail.dividendYield
          : null,
      fiftyTwoWeekHigh:
        typeof detailsResult?.summaryDetail?.fiftyTwoWeekHigh === "number"
          ? detailsResult.summaryDetail.fiftyTwoWeekHigh
          : null,
      fiftyTwoWeekLow:
        typeof detailsResult?.summaryDetail?.fiftyTwoWeekLow === "number"
          ? detailsResult.summaryDetail.fiftyTwoWeekLow
          : null,
    },
    isStale: activeHoldingRecord?.lastQuoteAt == null,
    lastUpdatedAt: activeHoldingRecord?.lastQuoteAt?.toISOString() || null,
  };
}

export async function getActiveHoldingSymbols(userId: string) {
  await connectToDatabase();

  const holdings = (await StockHolding.find({ userId, status: "ACTIVE" })
    .select({ symbol: 1, companyName: 1 })
    .lean()) as Array<{ symbol: string; companyName: string }>;

  return holdings;
}

export async function validateActiveHoldingSymbol(userId: string, symbol: string) {
  const holding = await loadActiveHolding(userId, symbol);
  return Boolean(holding);
}
