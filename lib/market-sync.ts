import "server-only";

import { Types } from "mongoose";

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

function getBatchStatus(items: MarketSyncItemLean[]) {
  if (!items.length) {
    return "error" as const;
  }

  if (items.every((item) => item.status === "synced" || item.status === "skipped")) {
    return "synced" as const;
  }

  if (items.every((item) => item.status === "approved" || item.status === "error")) {
    return "approved" as const;
  }

  if (items.some((item) => item.status === "approved")) {
    return "partially_approved" as const;
  }

  return "pending" as const;
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
  const items = [...stockItems, ...mutualFundItems];
  const batch = await MarketSyncBatch.create({
    userId: input.userId,
    date,
    source: input.source,
    assetType: input.assetType,
    status: items.length ? "pending" : "error",
    fetchedAt,
    items,
    errorMessage: items.length ? "" : "No active stock or mutual fund holdings to refresh.",
  });

  return normalizeBatch(batch.toObject() as MarketSyncBatchLean);
}

export async function createCronMarketSyncBatches() {
  await connectToDatabase();

  const users = await User.find({ status: "active" }).select({ _id: 1 }).lean();
  const batches: MarketSyncBatchSummary[] = [];

  for (const user of users) {
    const batch = await createMarketSyncBatch({
      userId: String(user._id),
      assetType: "mixed",
      source: "cron",
    });

    if (batch.items.length) {
      batches.push(batch);
    }
  }

  return batches;
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

async function loadBatchForUser(userId: string, batchId: string) {
  if (!Types.ObjectId.isValid(batchId)) {
    throw new Error("Invalid market sync batch ID.");
  }

  await connectToDatabase();

  const batch = (await MarketSyncBatch.findOne({
    _id: toObjectId(batchId),
    userId: toObjectId(userId),
  }).lean()) as MarketSyncBatchLean | null;

  if (!batch) {
    throw new Error("Market sync batch not found.");
  }

  return batch;
}

function getSelectedItemIds(batch: MarketSyncBatchLean, itemIds?: string[] | null) {
  const allPendingIds = batch.items
    .filter((item) => item.status === "pending")
    .map((item) => String(item._id));

  if (!itemIds?.length) {
    return allPendingIds;
  }

  const allowed = new Set(allPendingIds);
  return itemIds.filter((itemId) => allowed.has(itemId));
}

export async function approveMarketSyncBatchItems(input: {
  userId: string;
  batchId: string;
  itemIds?: string[] | null;
}) {
  const batch = await loadBatchForUser(input.userId, input.batchId);
  const selectedIds = new Set(getSelectedItemIds(batch, input.itemIds));

  if (!selectedIds.size) {
    throw new Error("No pending rows selected for approval.");
  }

  const items = batch.items.map((item) => ({
    ...item,
    status: selectedIds.has(String(item._id)) ? ("approved" as const) : item.status,
  }));

  await MarketSyncBatch.updateOne(
    { _id: toObjectId(input.batchId), userId: toObjectId(input.userId) },
    {
      $set: {
        items,
        status: getBatchStatus(items),
      },
    }
  );

  const updated = await loadBatchForUser(input.userId, input.batchId);
  return normalizeBatch(updated);
}

export async function syncApprovedMarketSyncBatch(input: {
  userId: string;
  batchId: string;
}) {
  const batch = await loadBatchForUser(input.userId, input.batchId);
  const approvedItems = batch.items.filter((item) => item.status === "approved");

  if (!approvedItems.length) {
    throw new Error("Approve at least one row before syncing.");
  }

  const syncedAt = new Date();

  await upsertDailyValues(
    approvedItems.map((item) => ({
      userId: input.userId,
      date: batch.date,
      scope: "holding",
      assetType: item.assetType,
      assetKey: item.assetKey,
      assetLabel: item.assetLabel,
      priceOrNav: item.newPriceOrNav ?? null,
      quantityOrUnits: item.quantityOrUnits,
      investedAmount: item.investedAmount,
      currentValue: item.newValue,
      gainLoss: item.newValue - item.investedAmount,
      source: batch.source,
      sourceFetchedAt: item.newFetchedAt,
      syncedAt,
    }))
  );

  const items = batch.items.map((item) => {
    if (item.status === "approved") {
      return { ...item, status: "synced" as const };
    }

    if (item.status === "pending") {
      return { ...item, status: "skipped" as const };
    }

    return item;
  });

  await MarketSyncBatch.updateOne(
    { _id: toObjectId(input.batchId), userId: toObjectId(input.userId) },
    {
      $set: {
        items,
        status: "synced",
        syncedAt,
      },
    }
  );

  await saveDailyPortfolioValuesForUser(input.userId);

  const updated = await loadBatchForUser(input.userId, input.batchId);
  return normalizeBatch(updated);
}

export async function discardMarketSyncBatch(input: {
  userId: string;
  batchId: string;
}) {
  const batch = await loadBatchForUser(input.userId, input.batchId);
  const items = batch.items.map((item) =>
    item.status === "pending" || item.status === "approved"
      ? { ...item, status: "skipped" as const }
      : item
  );

  await MarketSyncBatch.updateOne(
    { _id: toObjectId(input.batchId), userId: toObjectId(input.userId) },
    {
      $set: {
        items,
        status: "discarded",
      },
    }
  );

  const updated = await loadBatchForUser(input.userId, input.batchId);
  return normalizeBatch(updated);
}
