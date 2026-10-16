import "server-only";

import { Types } from "mongoose";

import { syncSovereignGoldBondValuesForUser } from "@/lib/gold";
import { syncGoldValuations } from "@/lib/gold-tracking";
import { refreshResearchForSymbols } from "@/lib/stock-research";
import {
  getLatestHoldingValueMap,
  getTodayDateKey,
  upsertDailyValues,
} from "@/lib/daily-values";
import { saveDailyPortfolioValuesForUser } from "@/lib/dashboard";
import { connectToDatabase } from "@/lib/mongodb";
import { MarketSyncBatch } from "@/lib/models/market-sync-batch";
import { User } from "@/lib/models/user";
import { getActiveMutualFundPositions, getMutualFundLatestNav } from "@/lib/mutual-funds";
import { getBulkQuotes } from "@/lib/services/yahoo-finance.service";
import { getActiveStockPositions } from "@/lib/stocks";
import { roundCurrency, roundPercent } from "@/lib/stocks-calculations";
import type { StockQuote } from "@/lib/stocks.types";

export type MarketSyncRefreshAssetType = "stock" | "mutual_fund" | "mixed";
export type MarketSyncSource = "cron" | "manual";

type MarketSyncBatchLean = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  date: string;
  source: MarketSyncSource;
  assetType: MarketSyncRefreshAssetType;
  status: "pending" | "partially_approved" | "approved" | "synced" | "discarded" | "error";
  fetchedAt: Date;
  syncedAt?: Date | null;
  items: MarketSyncItemLean[];
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type MarketSyncItemLean = {
  _id: Types.ObjectId | string;
  itemKey: string;
  assetType: "stock" | "mutual_fund";
  assetKey: string;
  assetLabel: string;
  quantityOrUnits: number;
  investedAmount: number;
  oldPriceOrNav?: number | null;
  oldValue: number;
  oldSyncedAt?: Date | null;
  newPriceOrNav?: number | null;
  newValue: number;
  newFetchedAt: Date;
  changeAmount: number;
  changePercent?: number | null;
  status: "pending" | "approved" | "synced" | "skipped" | "error";
  errorMessage?: string;
};

export type MarketSyncItemSummary = {
  id: string;
  itemKey: string;
  assetType: "stock" | "mutual_fund";
  assetKey: string;
  assetLabel: string;
  quantityOrUnits: number;
  investedAmount: number;
  oldPriceOrNav: number | null;
  oldValue: number;
  oldSyncedAt: string | null;
  newPriceOrNav: number | null;
  newValue: number;
  newFetchedAt: string;
  changeAmount: number;
  changePercent: number | null;
  status: "pending" | "approved" | "synced" | "skipped" | "error";
  errorMessage: string;
};

export type MarketSyncBatchSummary = {
  id: string;
  userId: string;
  date: string;
  source: MarketSyncSource;
  assetType: MarketSyncRefreshAssetType;
  status: MarketSyncBatchLean["status"];
  fetchedAt: string;
  syncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  itemCounts: Record<MarketSyncItemSummary["status"], number>;
  items: MarketSyncItemSummary[];
  errorMessage: string;
};

export type MarketSyncCronFailure = {
  userId: string;
  message: string;
};

export type MarketSyncCronRunSummary = {
  userCount: number;
  batchCount: number;
  failureCount: number;
  batches: MarketSyncBatchSummary[];
  failures: MarketSyncCronFailure[];
};

function toObjectId(value: string) {
  return new Types.ObjectId(value);
}

function normalizeItem(item: MarketSyncItemLean): MarketSyncItemSummary {
  return {
    id: String(item._id),
    itemKey: item.itemKey,
    assetType: item.assetType,
    assetKey: item.assetKey,
    assetLabel: item.assetLabel,
    quantityOrUnits: roundCurrency(item.quantityOrUnits || 0),
    investedAmount: roundCurrency(item.investedAmount || 0),
    oldPriceOrNav: item.oldPriceOrNav ?? null,
    oldValue: roundCurrency(item.oldValue || 0),
    oldSyncedAt: item.oldSyncedAt?.toISOString() || null,
    newPriceOrNav: item.newPriceOrNav ?? null,
    newValue: roundCurrency(item.newValue || 0),
    newFetchedAt: item.newFetchedAt.toISOString(),
    changeAmount: roundCurrency(item.changeAmount || 0),
    changePercent: item.changePercent ?? null,
    status: item.status,
    errorMessage: item.errorMessage || "",
  };
}

function normalizeBatch(batch: MarketSyncBatchLean): MarketSyncBatchSummary {
  const items = batch.items.map(normalizeItem);
  const itemCounts = {
    pending: 0,
    approved: 0,
    synced: 0,
    skipped: 0,
    error: 0,
  };

  for (const item of items) {
    itemCounts[item.status] += 1;
  }

  return {
    id: String(batch._id),
    userId: String(batch.userId),
    date: batch.date,
    source: batch.source,
    assetType: batch.assetType,
    status: batch.status,
    fetchedAt: batch.fetchedAt.toISOString(),
    syncedAt: batch.syncedAt?.toISOString() || null,
    createdAt: batch.createdAt?.toISOString() || null,
    updatedAt: batch.updatedAt?.toISOString() || null,
    itemCounts,
    items,
    errorMessage: batch.errorMessage || "",
  };
}

async function buildStockItems(userId: string, fetchedAt: Date) {
  const positions = await getActiveStockPositions(userId);
  const symbols = positions.map((position) => position.symbol);
  const [oldValueMap, quoteMap] = await Promise.all([
    getLatestHoldingValueMap(userId, "stock", symbols),
    getBulkQuotes(symbols).catch(() => ({} as Record<string, StockQuote | null>)),
  ]);

  return positions.map((position) => {
    const oldValue = oldValueMap.get(position.symbol) || null;
    const quote = quoteMap[position.symbol] || null;
    const newPrice = quote?.regularMarketPrice ?? null;
    const newValue =
      newPrice == null ? oldValue?.currentValue || 0 : roundCurrency(newPrice * position.quantity);
    const changeAmount = roundCurrency(newValue - (oldValue?.currentValue || 0));

    return {
      itemKey: `stock:${position.symbol}`,
      assetType: "stock" as const,
      assetKey: position.symbol,
      assetLabel: position.companyName || position.symbol,
      quantityOrUnits: position.quantity,
      investedAmount: position.investedAmount,
      oldPriceOrNav: oldValue?.priceOrNav ?? null,
      oldValue: oldValue?.currentValue || 0,
      oldSyncedAt: oldValue?.sourceFetchedAt ? new Date(oldValue.sourceFetchedAt) : null,
      newPriceOrNav: newPrice,
      newValue,
      newFetchedAt: fetchedAt,
      changeAmount,
      changePercent:
        oldValue && oldValue.currentValue > 0
          ? roundPercent((changeAmount / oldValue.currentValue) * 100)
          : null,
      status: newPrice == null ? ("error" as const) : ("pending" as const),
      errorMessage: newPrice == null ? "Price unavailable from Yahoo Finance." : "",
    };
  });
}

async function buildMutualFundItems(userId: string, fetchedAt: Date) {
  const positions = await getActiveMutualFundPositions(userId);
  const schemeKeys = positions.map((position) => String(position.schemeCode));
  const oldValueMap = await getLatestHoldingValueMap(userId, "mutual_fund", schemeKeys);

  return Promise.all(
    positions.map(async (position) => {
      const oldValue = oldValueMap.get(String(position.schemeCode)) || null;
      const latestNav = await getMutualFundLatestNav(position.schemeCode).catch(() => null);
      const newValue =
        latestNav == null ? oldValue?.currentValue || 0 : roundCurrency(position.units * latestNav);
      const changeAmount = roundCurrency(newValue - (oldValue?.currentValue || 0));

      return {
        itemKey: `mutual_fund:${position.schemeCode}`,
        assetType: "mutual_fund" as const,
        assetKey: String(position.schemeCode),
        assetLabel: position.schemeName,
        quantityOrUnits: position.units,
        investedAmount: position.investedAmount,
        oldPriceOrNav: oldValue?.priceOrNav ?? null,
        oldValue: oldValue?.currentValue || 0,
        oldSyncedAt: oldValue?.sourceFetchedAt ? new Date(oldValue.sourceFetchedAt) : null,
        newPriceOrNav: latestNav,
        newValue,
        newFetchedAt: fetchedAt,
        changeAmount,
        changePercent:
          oldValue && oldValue.currentValue > 0
            ? roundPercent((changeAmount / oldValue.currentValue) * 100)
            : null,
        status: latestNav == null ? ("error" as const) : ("pending" as const),
        errorMessage: latestNav == null ? "NAV unavailable from mfapi." : "",
      };
    })
  );
}

async function upsertHoldingValuesFromItems(input: {
  userId: string;
  date: string;
  source: MarketSyncSource;
  items: MarketSyncItemLean[] | Array<Omit<MarketSyncItemLean, "_id">>;
  syncedAt: Date;
}) {
  await upsertDailyValues(
    input.items.map((item) => ({
      userId: input.userId,
      date: input.date,
      scope: "holding" as const,
      assetType: item.assetType,
      assetKey: item.assetKey,
      assetLabel: item.assetLabel,
      priceOrNav: item.newPriceOrNav ?? null,
      quantityOrUnits: item.quantityOrUnits,
      investedAmount: item.investedAmount,
      currentValue: item.newValue,
      gainLoss: item.newValue - item.investedAmount,
      source: input.source,
      sourceFetchedAt: item.newFetchedAt,
      syncedAt: input.syncedAt,
    }))
  );
}

// Older batches still waiting on manual approval are superseded by a newer sync.
async function supersedeOpenBatches(userId: string, exceptBatchId: Types.ObjectId | string) {
  await MarketSyncBatch.updateMany(
    {
      userId: toObjectId(userId),
      _id: { $ne: exceptBatchId },
      status: { $in: ["pending", "partially_approved", "approved"] },
    },
    { $set: { status: "discarded" } }
  );
}

/**
 * Fetches fresh prices/NAVs and applies them immediately (no manual approval).
 * Rows whose price could not be fetched keep their previous value and are recorded
 * as errors on the batch for visibility.
 */
export async function createMarketSyncBatch(input: {
  userId: string;
  assetType: MarketSyncRefreshAssetType;
  source: MarketSyncSource;
}) {
  await connectToDatabase();

  const fetchedAt = new Date();
  const date = getTodayDateKey();
  const [stockItems, mutualFundItems] = await Promise.all([
    input.assetType === "stock" || input.assetType === "mixed"
      ? buildStockItems(input.userId, fetchedAt)
      : Promise.resolve([]),
    input.assetType === "mutual_fund" || input.assetType === "mixed"
      ? buildMutualFundItems(input.userId, fetchedAt)
      : Promise.resolve([]),
  ]);
  const builtItems = [...stockItems, ...mutualFundItems];

  if (!builtItems.length) {
    return null;
  }

  const syncedAt = new Date();
  const items = builtItems.map((item) =>
    item.status === "pending" ? { ...item, status: "synced" as const } : item
  );
  const syncedItems = items.filter((item) => item.status === "synced");

  if (syncedItems.length) {
    await upsertHoldingValuesFromItems({
      userId: input.userId,
      date,
      source: input.source,
      items: syncedItems,
      syncedAt,
    });
  }

  const batch = await MarketSyncBatch.create({
    userId: input.userId,
    date,
    source: input.source,
    assetType: input.assetType,
    status: syncedItems.length ? "synced" : "error",
    fetchedAt,
    syncedAt: syncedItems.length ? syncedAt : null,
    items,
    errorMessage: syncedItems.length ? "" : "No prices could be fetched.",
  });

  await supersedeOpenBatches(input.userId, batch._id);

  return normalizeBatch(batch.toObject() as MarketSyncBatchLean);
}

// SGB buys recorded with units are priced from NSE; per-holding tracker tickers
// (Yahoo) run afterwards and win for the holdings they cover.
async function syncAllGoldValuations(userId: string) {
  const nse = await syncSovereignGoldBondValuesForUser(userId).catch(() => null);
  const trackers = await syncGoldValuations(userId).catch(() => ({ updated: 0, failed: 0 }));

  return {
    updated: (nse?.updatedCount || 0) + trackers.updated,
    failed: trackers.failed,
  };
}

export type MarketSyncRunAssetType = MarketSyncRefreshAssetType | "gold";

/** Full refresh for one user: market prices, gold valuations, then the daily net-worth snapshot. */
export async function runMarketSync(input: {
  userId: string;
  assetType?: MarketSyncRunAssetType;
  source: MarketSyncSource;
}) {
  const assetType = input.assetType || "mixed";
  const [gold, batch] = await Promise.all([
    assetType === "gold" || assetType === "mixed"
      ? syncAllGoldValuations(input.userId)
      : Promise.resolve({ updated: 0, failed: 0 }),
    assetType === "gold"
      ? Promise.resolve(null)
      : createMarketSyncBatch({ userId: input.userId, assetType, source: input.source }),
  ]);

  await saveDailyPortfolioValuesForUser(input.userId);

  return { batch, gold };
}

export async function runCronMarketSync() {
  await connectToDatabase();

  const users = await User.find({ status: "active" }).select({ _id: 1 }).lean();
  const results = [];

  for (const user of users) {
    const userId = String(user._id);

    try {
      const { batch, gold } = await runMarketSync({ userId, source: "cron" });
      // Fundamentals are cached for a week; this only refetches stale ones.
      const positions = await getActiveStockPositions(userId).catch(() => []);
      await refreshResearchForSymbols(positions.map((position) => position.symbol)).catch(() => 0);
      results.push({
        userId,
        synced: batch?.itemCounts.synced ?? 0,
        failed: batch?.itemCounts.error ?? 0,
        goldUpdated: gold.updated,
      });
    } catch (error) {
      console.error("Market data cron failed for user.", { userId, error });
      results.push({
        userId,
        error: error instanceof Error ? error.message : "Sync failed.",
      });
    }
  }

  return results;
}

export async function listMarketSyncBatches(input: {
  userId: string;
  source?: MarketSyncSource | "all";
  status?: MarketSyncBatchLean["status"] | "all";
  limit?: number;
}) {
  await connectToDatabase();

  const batches = (await MarketSyncBatch.find({
    userId: toObjectId(input.userId),
    ...(input.source && input.source !== "all" ? { source: input.source } : {}),
    ...(input.status && input.status !== "all" ? { status: input.status } : {}),
  })
    .sort({ fetchedAt: -1, createdAt: -1 })
    .limit(Math.min(Math.max(input.limit || 20, 1), 100))
    .lean()) as MarketSyncBatchLean[];

  return batches.map(normalizeBatch);
}
