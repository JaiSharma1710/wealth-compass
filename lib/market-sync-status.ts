import "server-only";

import { Types } from "mongoose";

import { getTodayDateKey } from "@/lib/daily-values";
import { MarketSyncBatch } from "@/lib/models/market-sync-batch";
import { connectToDatabase } from "@/lib/mongodb";

type LatestBatchLean = {
  date: string;
  fetchedAt: Date;
  syncedAt?: Date | null;
  items: Array<{ status: string; assetLabel: string; errorMessage?: string }>;
};

function toObjectId(value: string) {
  return new Types.ObjectId(value);
}

export async function getMarketSyncStatus(userId: string) {
  await connectToDatabase();

  const latest = (await MarketSyncBatch.findOne({
    userId: toObjectId(userId),
    status: "synced",
  })
    .sort({ fetchedAt: -1 })
    .lean()) as LatestBatchLean | null;
  const today = getTodayDateKey();

  return {
    lastSyncedAt: latest?.syncedAt?.toISOString() || latest?.fetchedAt.toISOString() || null,
    syncedToday: latest?.date === today,
    failedCount: latest ? latest.items.filter((item) => item.status === "error").length : 0,
    failedItems: latest
      ? latest.items
          .filter((item) => item.status === "error")
          .map((item) => ({ label: item.assetLabel, message: item.errorMessage || "" }))
      : [],
  };
}

