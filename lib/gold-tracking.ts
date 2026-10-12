import "server-only";

import { Types } from "mongoose";

import { getTodayDateKey } from "@/lib/daily-values";
import { getActiveGoldHoldings } from "@/lib/gold";
import type { GoldHoldingSummary, GoldInvestmentOption } from "@/lib/gold.types";
import { GoldPriceTracker } from "@/lib/models/gold-price-tracker";
import { GoldTransaction } from "@/lib/models/gold-transaction";
import { connectToDatabase } from "@/lib/mongodb";
import { getBulkQuotes, getStockQuote } from "@/lib/services/yahoo-finance.service";

export type GoldTrackerSummary = {
  holdingId: string;
  symbol: string;
  units: number;
  lastPrice: number | null;
  lastSyncedAt: string | null;
  lastError: string;
};

export type GoldTrackerSuggestion = {
  holdingId: string;
  symbol: string;
  price: number | null;
  suggestedUnits: number | null;
};

type TrackerLean = {
  holdingId: string;
  investmentOption: GoldInvestmentOption;
  schemeName: string;
  symbol: string;
  units: number;
  lastPrice?: number | null;
  lastSyncedAt?: Date | null;
  lastError?: string;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toSummary(tracker: TrackerLean): GoldTrackerSummary {
  return {
    holdingId: tracker.holdingId,
    symbol: tracker.symbol,
    units: tracker.units,
    lastPrice: tracker.lastPrice ?? null,
    lastSyncedAt: tracker.lastSyncedAt?.toISOString() || null,
    lastError: tracker.lastError || "",
  };
}

// Same date convention as manually entered gold transactions (local date-only).
function todayDateOnly() {
  const [year, month, day] = getTodayDateKey().split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function guessGoldSymbol(holding: Pick<GoldHoldingSummary, "investmentOption" | "schemeName">) {
  const compact = holding.schemeName.trim().toUpperCase().replace(/\s+/g, "");

  if (holding.investmentOption === "sovereign_gold_bond" && /^SGB[A-Z0-9]+$/.test(compact)) {
    return `${compact}-GB.NS`;
  }

  if (holding.investmentOption === "gold_etf" && /^[A-Z0-9&-]+$/.test(compact)) {
    return `${compact}.NS`;
  }

  return "";
}

export async function listGoldTrackers(userId: string) {
  await connectToDatabase();

  const trackers = await GoldPriceTracker.find({ userId: new Types.ObjectId(userId) }).lean<
    TrackerLean[]
  >();

  return trackers.map(toSummary);
}

async function findActiveHolding(userId: string, holdingId: string) {
  const holdings = await getActiveGoldHoldings(userId);
  const holding = holdings.find((entry) => entry.id === holdingId);

  if (!holding) {
    throw new Error("Choose an active gold holding.");
  }

  return holding;
}

export async function suggestGoldTracker(
  userId: string,
  holdingId: string
): Promise<GoldTrackerSuggestion> {
  const holding = await findActiveHolding(userId, holdingId);
  const symbol = guessGoldSymbol(holding);
  const quote = symbol ? await getStockQuote(symbol).catch(() => null) : null;
  const price = quote?.regularMarketPrice ?? null;
  const rawUnits = price && price > 0 ? holding.currentValue / price : null;

  return {
    holdingId,
    symbol,
    price,
    // SGBs are issued in whole grams; ETFs in whole units.
    suggestedUnits: rawUnits == null ? null : Math.max(1, Math.round(rawUnits)),
  };
}

export async function saveGoldTracker(
  userId: string,
  input: { holdingId: string; symbol: string; units: number }
) {
  const holding = await findActiveHolding(userId, input.holdingId);
  const symbol = input.symbol.trim().toUpperCase();

  if (!symbol) {
    throw new Error("Ticker symbol is required.");
  }

  if (!Number.isFinite(input.units) || input.units <= 0) {
    throw new Error("Units must be greater than zero.");
  }

  await connectToDatabase();
  await GoldPriceTracker.updateOne(
    { userId: new Types.ObjectId(userId), holdingId: holding.id },
    {
      $set: {
        userId: new Types.ObjectId(userId),
        holdingId: holding.id,
        investmentOption: holding.investmentOption,
        schemeName: holding.schemeName,
        symbol,
        units: input.units,
      },
    },
    { upsert: true }
  );

  await syncGoldValuations(userId);
}

export async function deleteGoldTracker(userId: string, holdingId: string) {
  await connectToDatabase();
  await GoldPriceTracker.deleteOne({ userId: new Types.ObjectId(userId), holdingId });
}

// Writes today's valuation for every auto-priced gold holding. Re-running on the same
// day replaces that day's valuation instead of stacking duplicates.
export async function syncGoldValuations(userId: string) {
  await connectToDatabase();

  const trackers = await GoldPriceTracker.find({ userId: new Types.ObjectId(userId) }).lean<
    TrackerLean[]
  >();

  if (!trackers.length) {
    return { updated: 0, failed: 0 };
  }

  const holdings = await getActiveGoldHoldings(userId);
  const activeIds = new Set(holdings.map((holding) => holding.id));
  const liveTrackers = trackers.filter((tracker) => activeIds.has(tracker.holdingId));
  const quotes = await getBulkQuotes(liveTrackers.map((tracker) => tracker.symbol)).catch(
    () => ({}) as Awaited<ReturnType<typeof getBulkQuotes>>
  );
  const transactionDate = todayDateOnly();
  const now = new Date();
  let updated = 0;
  let failed = 0;

  for (const tracker of liveTrackers) {
    const price = quotes[tracker.symbol]?.regularMarketPrice ?? null;

    if (price == null || price <= 0) {
      failed += 1;
      await GoldPriceTracker.updateOne(
        { userId: new Types.ObjectId(userId), holdingId: tracker.holdingId },
        { $set: { lastError: `No price available for ${tracker.symbol}.` } }
      );
      continue;
    }

    await GoldTransaction.updateOne(
      {
        userId: new Types.ObjectId(userId),
        investmentOption: tracker.investmentOption,
        schemeName: tracker.schemeName,
        transactionType: "valuation",
        transactionDate,
      },
      {
        $set: {
          currentValue: roundCurrency(price * tracker.units),
          investedAmount: null,
          sellAmount: null,
        },
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          investmentOption: tracker.investmentOption,
          schemeName: tracker.schemeName,
          transactionType: "valuation",
          transactionDate,
        },
      },
      { upsert: true }
    );
    await GoldPriceTracker.updateOne(
      { userId: new Types.ObjectId(userId), holdingId: tracker.holdingId },
      { $set: { lastPrice: price, lastSyncedAt: now, lastError: "" } }
    );
    updated += 1;
  }

  return { updated, failed };
}
