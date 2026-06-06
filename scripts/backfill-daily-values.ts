import mongoose from "mongoose";

import { DailyValue } from "@/lib/models/daily-value";
import { MutualFundMonthlySnapshot } from "@/lib/models/mutual-fund-monthly-snapshot";
import { PortfolioSnapshot } from "@/lib/models/portfolio-snapshot";
import { StockHolding } from "@/lib/models/stock-holding";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "wealth-compass";

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable.");
}

const mongoUri = MONGODB_URI;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

async function upsertDailyValue(input: {
  userId: mongoose.Types.ObjectId | string;
  date: string;
  scope: "holding" | "asset" | "portfolio";
  assetType: "stock" | "mutual_fund" | "gold" | "cash" | "portfolio";
  assetKey: string;
  assetLabel: string;
  priceOrNav?: number | null;
  quantityOrUnits?: number | null;
  investedAmount: number;
  currentValue: number;
  source: "migration";
  sourceFetchedAt?: Date | null;
  syncedAt?: Date;
}) {
  await DailyValue.updateOne(
    {
      userId: input.userId,
      date: input.date,
      scope: input.scope,
      assetType: input.assetType,
      assetKey: input.assetKey,
    },
    {
      $set: {
        ...input,
        gainLoss: roundCurrency(input.currentValue - input.investedAmount),
        syncedAt: input.syncedAt || new Date(),
      },
    },
    { upsert: true }
  );
}

async function backfillStocks() {
  const today = new Date().toISOString().slice(0, 10);
  const holdings = await StockHolding.find({ status: "ACTIVE" }).lean();

  for (const holding of holdings) {
    await upsertDailyValue({
      userId: holding.userId,
      date: today,
      scope: "holding",
      assetType: "stock",
      assetKey: holding.symbol,
      assetLabel: holding.companyName,
      priceOrNav: holding.currentPrice ?? null,
      quantityOrUnits: holding.quantity,
      investedAmount: holding.investedAmount,
      currentValue: holding.currentValue,
      source: "migration",
      sourceFetchedAt: holding.lastQuoteAt || null,
      syncedAt: holding.updatedAt || new Date(),
    });
  }

  console.log(`Backfilled ${holdings.length} stock holding values.`);
}

async function backfillMutualFundMonthlySnapshots() {
  const snapshots = await MutualFundMonthlySnapshot.find({}).lean();

  for (const snapshot of snapshots) {
    const date = `${snapshot.monthKey}-01`;

    await upsertDailyValue({
      userId: snapshot.userId,
      date,
      scope: "asset",
      assetType: "mutual_fund",
      assetKey: "total",
      assetLabel: "Mutual Funds",
      investedAmount: snapshot.totalInvested,
      currentValue: snapshot.totalValue,
      source: "migration",
      syncedAt: snapshot.updatedAt || new Date(),
    });

    for (const holding of snapshot.distribution || []) {
      await upsertDailyValue({
        userId: snapshot.userId,
        date,
        scope: "holding",
        assetType: "mutual_fund",
        assetKey: String(holding.schemeCode),
        assetLabel: holding.schemeName,
        priceOrNav: holding.currentNav,
        quantityOrUnits: holding.units,
        investedAmount: holding.investedAmount,
        currentValue: holding.currentValue,
        source: "migration",
        syncedAt: snapshot.updatedAt || new Date(),
      });
    }
  }

  console.log(`Backfilled ${snapshots.length} mutual fund monthly snapshots.`);
}

async function backfillPortfolioSnapshots() {
  const snapshots = await PortfolioSnapshot.find({}).lean();

  for (const snapshot of snapshots) {
    await Promise.all([
      upsertDailyValue({
        userId: snapshot.userId,
        date: snapshot.date,
        scope: "asset",
        assetType: "stock",
        assetKey: "total",
        assetLabel: "Stocks",
        investedAmount: 0,
        currentValue: snapshot.stocksValue,
        source: "migration",
        syncedAt: snapshot.updatedAt || new Date(),
      }),
      upsertDailyValue({
        userId: snapshot.userId,
        date: snapshot.date,
        scope: "asset",
        assetType: "mutual_fund",
        assetKey: "total",
        assetLabel: "Mutual Funds",
        investedAmount: 0,
        currentValue: snapshot.mutualFundsValue,
        source: "migration",
        syncedAt: snapshot.updatedAt || new Date(),
      }),
      upsertDailyValue({
        userId: snapshot.userId,
        date: snapshot.date,
        scope: "asset",
        assetType: "gold",
        assetKey: "total",
        assetLabel: "Gold",
        investedAmount: 0,
        currentValue: snapshot.goldValue,
        source: "migration",
        syncedAt: snapshot.updatedAt || new Date(),
      }),
      upsertDailyValue({
        userId: snapshot.userId,
        date: snapshot.date,
        scope: "asset",
        assetType: "cash",
        assetKey: "total",
        assetLabel: "Cash and Reserves",
        investedAmount: snapshot.cashValue,
        currentValue: snapshot.cashValue,
        source: "migration",
        syncedAt: snapshot.updatedAt || new Date(),
      }),
      upsertDailyValue({
        userId: snapshot.userId,
        date: snapshot.date,
        scope: "portfolio",
        assetType: "portfolio",
        assetKey: "total",
        assetLabel: "Total Portfolio",
        investedAmount: snapshot.totalInvested,
        currentValue: snapshot.totalCurrentWorth,
        source: "migration",
        syncedAt: snapshot.updatedAt || new Date(),
      }),
    ]);
  }

  console.log(`Backfilled ${snapshots.length} portfolio snapshots.`);
}

async function main() {
  await mongoose.connect(mongoUri, { dbName: DB_NAME });

  await backfillStocks();
  await backfillMutualFundMonthlySnapshots();
  await backfillPortfolioSnapshots();

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
