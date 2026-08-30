import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
  userLean: vi.fn(),
  marketSyncBatchCreate: vi.fn(),
  marketSyncBatchFind: vi.fn(),
  marketSyncBatchFindOne: vi.fn(),
  marketSyncBatchUpdateOne: vi.fn(),
  getLatestHoldingValueMap: vi.fn(),
  getTodayDateKey: vi.fn(() => "2026-08-30"),
  upsertDailyValues: vi.fn(),
  saveDailyPortfolioValuesForUser: vi.fn(),
  getActiveStockPositions: vi.fn(),
  getActiveMutualFundPositions: vi.fn(),
  getMutualFundLatestNav: vi.fn(),
  getBulkQuotes: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  connectToDatabase: mocks.connectToDatabase,
}));

vi.mock("@/lib/daily-values", () => ({
  getLatestHoldingValueMap: mocks.getLatestHoldingValueMap,
  getTodayDateKey: mocks.getTodayDateKey,
  upsertDailyValues: mocks.upsertDailyValues,
}));

vi.mock("@/lib/dashboard", () => ({
  saveDailyPortfolioValuesForUser: mocks.saveDailyPortfolioValuesForUser,
}));

vi.mock("@/lib/models/user", () => ({
  User: {
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: mocks.userLean,
      })),
    })),
  },
}));

vi.mock("@/lib/models/market-sync-batch", () => ({
  MarketSyncBatch: {
    create: mocks.marketSyncBatchCreate,
    find: mocks.marketSyncBatchFind,
    findOne: mocks.marketSyncBatchFindOne,
    updateOne: mocks.marketSyncBatchUpdateOne,
  },
}));

vi.mock("@/lib/stocks", () => ({
  getActiveStockPositions: mocks.getActiveStockPositions,
}));

vi.mock("@/lib/mutual-funds", () => ({
  getActiveMutualFundPositions: mocks.getActiveMutualFundPositions,
  getMutualFundLatestNav: mocks.getMutualFundLatestNav,
}));

vi.mock("@/lib/services/yahoo-finance.service", () => ({
  getBulkQuotes: mocks.getBulkQuotes,
}));

import { createCronMarketSyncBatches, createMarketSyncBatch } from "@/lib/market-sync";

const userOneId = "507f1f77bcf86cd799439011";
const userTwoId = "507f1f77bcf86cd799439012";

function stockPosition(symbol = "RELIANCE.NS") {
  return {
    symbol,
    companyName: "Reliance Industries",
    quantity: 2,
    investedAmount: 4800,
  };
}

function createBatchDocument(input: {
  userId: string;
  date: string;
  source: "cron" | "manual";
  assetType: "stock" | "mutual_fund" | "mixed";
  status: string;
  fetchedAt: Date;
  items: Array<Record<string, unknown>>;
  errorMessage: string;
}) {
  const createdAt = new Date("2026-08-30T01:30:00.000Z");

  return {
    toObject: () => ({
      _id: "66d2a4d1f1d2a4d1f1d2a4d1",
      ...input,
      createdAt,
      updatedAt: createdAt,
      items: input.items.map((item, index) => ({
        _id: `66d2a4d1f1d2a4d1f1d2a4d${index}`,
        ...item,
      })),
    }),
  };
}

describe("market sync cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectToDatabase.mockResolvedValue(undefined);
    mocks.userLean.mockResolvedValue([{ _id: userOneId }, { _id: userTwoId }]);
    mocks.getLatestHoldingValueMap.mockResolvedValue(new Map());
    mocks.getActiveMutualFundPositions.mockResolvedValue([]);
    mocks.getMutualFundLatestNav.mockResolvedValue(null);
    mocks.getBulkQuotes.mockResolvedValue({
      "RELIANCE.NS": {
        regularMarketPrice: 2500,
        regularMarketChange: null,
        regularMarketChangePercent: null,
        regularMarketPreviousClose: null,
        marketState: "REGULAR",
        isMarketOpen: true,
      },
    });
    mocks.marketSyncBatchCreate.mockImplementation(async (input) => createBatchDocument(input));
  });

  it("continues creating approval batches when one active user fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getActiveStockPositions.mockImplementation(async (userId: string) => {
      if (userId === userOneId) {
        throw new Error("stock lookup failed");
      }

      return [stockPosition()];
    });

    const result = await createCronMarketSyncBatches();

    expect(result.userCount).toBe(2);
    expect(result.batchCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.failures).toEqual([{ userId: userOneId, message: "stock lookup failed" }]);
    expect(result.batches[0]).toMatchObject({
      userId: userTwoId,
      source: "cron",
      assetType: "mixed",
      status: "pending",
      itemCounts: {
        pending: 1,
        approved: 0,
        synced: 0,
        skipped: 0,
        error: 0,
      },
    });
    expect(mocks.marketSyncBatchCreate).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it("marks a batch as error when fetched market rows all failed", async () => {
    mocks.getActiveStockPositions.mockResolvedValue([stockPosition()]);
    mocks.getBulkQuotes.mockResolvedValue({ "RELIANCE.NS": null });

    const batch = await createMarketSyncBatch({
      userId: userTwoId,
      assetType: "stock",
      source: "cron",
    });

    expect(batch.status).toBe("error");
    expect(batch.itemCounts.error).toBe(1);
    expect(batch.items[0]).toMatchObject({
      assetKey: "RELIANCE.NS",
      status: "error",
      errorMessage: "Price unavailable from Yahoo Finance.",
    });
  });
});
