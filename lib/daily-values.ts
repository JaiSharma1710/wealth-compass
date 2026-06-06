import "server-only";

import { Types } from "mongoose";

import {
  filterHistoryByRange,
  getDateKeyInTimeZone,
  roundCurrency,
} from "@/lib/dashboard-calculations";
import type { DashboardHistoryPoint, DashboardHistoryRange } from "@/lib/dashboard.types";
import { connectToDatabase } from "@/lib/mongodb";
import {
  DailyValue,
  DAILY_VALUE_ASSET_TYPES,
  DAILY_VALUE_SCOPES,
  DAILY_VALUE_SOURCES,
  type DailyValueDocument,
} from "@/lib/models/daily-value";

export type DailyValueAssetType = (typeof DAILY_VALUE_ASSET_TYPES)[number];
export type DailyValueScope = (typeof DAILY_VALUE_SCOPES)[number];
export type DailyValueSource = (typeof DAILY_VALUE_SOURCES)[number];

export type DailyValueRecord = {
  id: string;
  userId: string;
  date: string;
  scope: DailyValueScope;
  assetType: DailyValueAssetType;
  assetKey: string;
  assetLabel: string;
  priceOrNav: number | null;
  quantityOrUnits: number | null;
  investedAmount: number;
  currentValue: number;
  gainLoss: number;
  source: DailyValueSource;
  sourceFetchedAt: string | null;
  syncedAt: string;
};

export type DailyValueUpsertInput = {
  userId: string;
  date?: string;
  scope: DailyValueScope;
  assetType: DailyValueAssetType;
  assetKey: string;
  assetLabel?: string;
  priceOrNav?: number | null;
  quantityOrUnits?: number | null;
  investedAmount?: number;
  currentValue: number;
  gainLoss?: number;
  source: DailyValueSource;
  sourceFetchedAt?: Date | null;
  syncedAt?: Date;
};

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const TOTAL_ASSET_KEY = "total";

type DailyValueLean = DailyValueDocument & {
  _id: Types.ObjectId | string;
  sourceFetchedAt?: Date | null;
  syncedAt: Date;
};

function toObjectId(value: string) {
  return new Types.ObjectId(value);
}

function normalizeDailyValue(value: DailyValueLean): DailyValueRecord {
  return {
    id: String(value._id),
    userId: String(value.userId),
    date: value.date,
    scope: value.scope as DailyValueScope,
    assetType: value.assetType as DailyValueAssetType,
    assetKey: value.assetKey,
    assetLabel: value.assetLabel || "",
    priceOrNav: value.priceOrNav ?? null,
    quantityOrUnits: value.quantityOrUnits ?? null,
    investedAmount: roundCurrency(value.investedAmount || 0),
    currentValue: roundCurrency(value.currentValue || 0),
    gainLoss: roundCurrency(value.gainLoss || 0),
    source: value.source as DailyValueSource,
    sourceFetchedAt: value.sourceFetchedAt?.toISOString() || null,
    syncedAt: value.syncedAt.toISOString(),
  };
}

export function getTodayDateKey(timeZone = DEFAULT_TIMEZONE) {
  return getDateKeyInTimeZone(new Date(), timeZone);
}

export function getTotalAssetKey() {
  return TOTAL_ASSET_KEY;
}

export async function upsertDailyValue(input: DailyValueUpsertInput) {
  await connectToDatabase();

  const date = input.date || getTodayDateKey();
  const currentValue = roundCurrency(input.currentValue);
  const investedAmount = roundCurrency(input.investedAmount || 0);
  const syncedAt = input.syncedAt || new Date();

  await DailyValue.updateOne(
    {
      userId: toObjectId(input.userId),
      date,
      scope: input.scope,
      assetType: input.assetType,
      assetKey: input.assetKey,
    },
    {
      $set: {
        userId: toObjectId(input.userId),
        date,
        scope: input.scope,
        assetType: input.assetType,
        assetKey: input.assetKey,
        assetLabel: input.assetLabel || "",
        priceOrNav: input.priceOrNav ?? null,
        quantityOrUnits: input.quantityOrUnits ?? null,
        investedAmount,
        currentValue,
        gainLoss: roundCurrency(input.gainLoss ?? currentValue - investedAmount),
        source: input.source,
        sourceFetchedAt: input.sourceFetchedAt || null,
        syncedAt,
      },
    },
    { upsert: true }
  );
}

export async function upsertDailyValues(inputs: DailyValueUpsertInput[]) {
  if (!inputs.length) {
    return;
  }

  await connectToDatabase();
  const writes = inputs.map((input) => {
    const date = input.date || getTodayDateKey();
    const currentValue = roundCurrency(input.currentValue);
    const investedAmount = roundCurrency(input.investedAmount || 0);

    return {
      updateOne: {
        filter: {
          userId: toObjectId(input.userId),
          date,
          scope: input.scope,
          assetType: input.assetType,
          assetKey: input.assetKey,
        },
        update: {
          $set: {
            userId: toObjectId(input.userId),
            date,
            scope: input.scope,
            assetType: input.assetType,
            assetKey: input.assetKey,
            assetLabel: input.assetLabel || "",
            priceOrNav: input.priceOrNav ?? null,
            quantityOrUnits: input.quantityOrUnits ?? null,
            investedAmount,
            currentValue,
            gainLoss: roundCurrency(input.gainLoss ?? currentValue - investedAmount),
            source: input.source,
            sourceFetchedAt: input.sourceFetchedAt || null,
            syncedAt: input.syncedAt || new Date(),
          },
        },
        upsert: true,
      },
    };
  });

  await DailyValue.bulkWrite(writes as Parameters<typeof DailyValue.bulkWrite>[0]);
}

async function getLatestValuesByKey(input: {
  userId: string;
  scope: DailyValueScope;
  assetType: DailyValueAssetType;
  assetKeys: string[];
  beforeDate?: string | null;
}) {
  const uniqueKeys = [...new Set(input.assetKeys.filter(Boolean))];

  if (!uniqueKeys.length) {
    return new Map<string, DailyValueRecord>();
  }

  await connectToDatabase();

  const values = (await DailyValue.find({
    userId: toObjectId(input.userId),
    scope: input.scope,
    assetType: input.assetType,
    assetKey: { $in: uniqueKeys },
    ...(input.beforeDate ? { date: { $lt: input.beforeDate } } : {}),
  })
    .sort({ assetKey: 1, date: -1, syncedAt: -1 })
    .lean()) as DailyValueLean[];

  const valueMap = new Map<string, DailyValueRecord>();

  for (const value of values) {
    if (!valueMap.has(value.assetKey)) {
      valueMap.set(value.assetKey, normalizeDailyValue(value));
    }
  }

  return valueMap;
}

export function getDailyValueFreshness(value: DailyValueRecord | null, date = getTodayDateKey()) {
  return {
    isStale: !value || value.date !== date,
    lastSyncedAt: value?.sourceFetchedAt || value?.syncedAt || null,
  };
}

export async function getLatestHoldingValueMap(
  userId: string,
  assetType: Extract<DailyValueAssetType, "stock" | "mutual_fund">,
  assetKeys: string[]
) {
  return getLatestValuesByKey({
    userId,
    scope: "holding",
    assetType,
    assetKeys,
  });
}

export async function getPreviousHoldingValueMap(
  userId: string,
  assetType: Extract<DailyValueAssetType, "stock" | "mutual_fund">,
  assetKeys: string[],
  beforeDate: string
) {
  return getLatestValuesByKey({
    userId,
    scope: "holding",
    assetType,
    assetKeys,
    beforeDate,
  });
}

export async function getLatestAssetTotal(
  userId: string,
  assetType: Exclude<DailyValueAssetType, "portfolio">
) {
  const map = await getLatestValuesByKey({
    userId,
    scope: "asset",
    assetType,
    assetKeys: [TOTAL_ASSET_KEY],
  });

  return map.get(TOTAL_ASSET_KEY) || null;
}

export async function getPortfolioHistoryFromDailyValues(
  userId: string,
  range: DashboardHistoryRange
): Promise<DashboardHistoryPoint[]> {
  await connectToDatabase();

  const rows = (await DailyValue.find({
    userId: toObjectId(userId),
    scope: { $in: ["asset", "portfolio"] },
    assetKey: TOTAL_ASSET_KEY,
  })
    .sort({ date: 1, scope: 1, assetType: 1 })
    .lean()) as DailyValueLean[];

  const byDate = new Map<string, DashboardHistoryPoint>();

  for (const row of rows) {
    const current =
      byDate.get(row.date) ||
      ({
        date: row.date,
        totalValue: 0,
        stocksValue: 0,
        mutualFundsValue: 0,
        goldValue: 0,
        cashValue: 0,
      } satisfies DashboardHistoryPoint);

    if (row.scope === "portfolio") {
      current.totalValue = roundCurrency(row.currentValue);
    } else if (row.assetType === "stock") {
      current.stocksValue = roundCurrency(row.currentValue);
    } else if (row.assetType === "mutual_fund") {
      current.mutualFundsValue = roundCurrency(row.currentValue);
    } else if (row.assetType === "gold") {
      current.goldValue = roundCurrency(row.currentValue);
    } else if (row.assetType === "cash") {
      current.cashValue = roundCurrency(row.currentValue);
    }

    byDate.set(row.date, current);
  }

  const history = [...byDate.values()].map((point) => ({
    ...point,
    totalValue:
      point.totalValue ||
      roundCurrency(
        point.stocksValue + point.mutualFundsValue + point.goldValue + point.cashValue
      ),
  }));

  return filterHistoryByRange(history, range);
}

export async function getMonthlyAssetValueSummaries(input: {
  userId: string;
  assetType: Exclude<DailyValueAssetType, "portfolio">;
  count: number;
}) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStarts = Array.from({ length: input.count }, (_, index) => {
    return new Date(
      currentMonthStart.getFullYear(),
      currentMonthStart.getMonth() - (input.count - 1 - index),
      1
    );
  });
  const firstMonthKey = `${monthStarts[0].getFullYear()}-${String(
    monthStarts[0].getMonth() + 1
  ).padStart(2, "0")}`;

  await connectToDatabase();

  const values = (await DailyValue.find({
    userId: toObjectId(input.userId),
    scope: "asset",
    assetType: input.assetType,
    assetKey: TOTAL_ASSET_KEY,
    date: { $gte: `${firstMonthKey}-01` },
  })
    .sort({ date: 1 })
    .lean()) as DailyValueLean[];
  const latestByMonth = new Map<string, DailyValueRecord>();

  for (const value of values) {
    latestByMonth.set(value.date.slice(0, 7), normalizeDailyValue(value));
  }

  return monthStarts.map((start) => {
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const value = latestByMonth.get(key);

    return {
      key,
      label: new Intl.DateTimeFormat("en", { month: "short" }).format(start),
      totalInvested: value?.investedAmount || 0,
      totalValue: value?.currentValue || 0,
    };
  });
}

export async function getHoldingDailyValueHistory(input: {
  userId: string;
  assetType: Extract<DailyValueAssetType, "stock" | "mutual_fund">;
  assetKey: string;
  limit?: number;
}) {
  await connectToDatabase();

  const values = (await DailyValue.find({
    userId: toObjectId(input.userId),
    scope: "holding",
    assetType: input.assetType,
    assetKey: input.assetKey,
  })
    .sort({ date: 1 })
    .limit(input.limit || 370)
    .lean()) as DailyValueLean[];

  return values.map(normalizeDailyValue);
}
