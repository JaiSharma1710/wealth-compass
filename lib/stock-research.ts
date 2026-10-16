import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { StockResearchModel } from "@/lib/models/stock-research";
import { fetchStockFundamentals } from "@/lib/stock-model/fetch";
import { scoreStock } from "@/lib/stock-model/score";
import type { StockFundamentals, StockRating, StockScorecard } from "@/lib/stock-model/types";
import { MODEL_VERSION } from "@/lib/stock-model/weights";
import { getStockDashboard } from "@/lib/stocks";
import type { StockHoldingSummary } from "@/lib/stocks.types";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PositionSignal = {
  action: "add" | "hold" | "trim" | "review" | "book_profit" | "watch";
  label: string;
  reason: string;
};

export type HoldingResearch = {
  symbol: string;
  name: string;
  weightPercent: number;
  returnsPercent: number;
  currentValue: number;
  scorecard: StockScorecard | null;
  signal: PositionSignal | null;
  error: string | null;
};

export type PortfolioResearch = {
  modelVersion: string;
  holdings: HoldingResearch[];
  ratingCounts: Record<StockRating, number>;
  /** Value-weighted portfolio score. */
  portfolioScore: number | null;
};

/** Fundamentals from the weekly cache, fetched from Yahoo when missing or stale. */
export async function getFundamentals(symbol: string, options: { force?: boolean } = {}): Promise<StockFundamentals> {
  await connectToDatabase();

  const key = symbol.toUpperCase();
  const cached = await StockResearchModel.findOne({ symbol: key }).lean();

  if (cached && !options.force && Date.now() - new Date(cached.fetchedAt).getTime() < MAX_AGE_MS) {
    return cached.fundamentals as StockFundamentals;
  }

  try {
    const fresh = await fetchStockFundamentals(key);
    await StockResearchModel.updateOne(
      { symbol: key },
      { $set: { symbol: key, fundamentals: fresh, fetchedAt: new Date() } },
      { upsert: true }
    );
    return fresh;
  } catch (error) {
    // Serve stale data rather than nothing if Yahoo is unavailable.
    if (cached) return cached.fundamentals as StockFundamentals;
    throw error;
  }
}

export async function getScorecard(symbol: string) {
  const fundamentals = await getFundamentals(symbol);
  return { fundamentals, scorecard: scoreStock(fundamentals) };
}

/**
 * Deterministic portfolio action: quality of the company (rating) combined with how the
 * position sits in *your* portfolio (weight, gain/loss). The AI explains; it doesn't decide.
 */
export function positionSignal(card: StockScorecard, holding: { weightPercent: number; returnsPercent: number }): PositionSignal {
  const valuation = card.pillars.find((pillar) => pillar.pillar === "valuation")?.score ?? 50;
  const overweight = holding.weightPercent > 25;

  if ((card.rating === "strong" || card.rating === "good") && overweight) {
    return { action: "trim", label: "Trim to rebalance", reason: `Good business, but ${holding.weightPercent.toFixed(0)}% of your stocks is concentration risk.` };
  }

  if (card.rating === "strong" && valuation >= 55) {
    return { action: "add", label: "Add on dips", reason: "High-quality business at a reasonable price." };
  }

  if (card.rating === "strong" || card.rating === "good") {
    return valuation < 35
      ? { action: "hold", label: "Hold, don't chase", reason: "Strong business but expensive right now; let valuation catch up before adding." }
      : { action: "hold", label: "Hold", reason: "Fundamentals support staying invested." };
  }

  if (card.rating === "average") {
    return { action: "watch", label: "Hold & monitor", reason: "Mixed fundamentals; track the next two quarterly results." };
  }

  return holding.returnsPercent >= 15
    ? { action: "book_profit", label: "Book partial profits", reason: "Weak fundamentals; lock in part of the gain." }
    : { action: "review", label: "Review — consider exit", reason: "Weak fundamentals; re-check your reason for owning it." };
}

function buildHoldingResearch(holding: StockHoldingSummary, totalValue: number) {
  return {
    symbol: holding.symbol,
    name: holding.companyName,
    weightPercent: totalValue ? (holding.currentValue / totalValue) * 100 : 0,
    returnsPercent: holding.unrealizedProfitPercent,
    currentValue: holding.currentValue,
  };
}

export async function getPortfolioResearch(userId: string): Promise<PortfolioResearch> {
  const dashboard = await getStockDashboard(userId);
  const totalValue = dashboard.totalCurrentValue;
  const queue = [...dashboard.holdings];
  const results: HoldingResearch[] = [];

  async function worker() {
    for (let holding = queue.shift(); holding; holding = queue.shift()) {
      const base = buildHoldingResearch(holding, totalValue);
      try {
        const { scorecard } = await getScorecard(holding.symbol);
        results.push({ ...base, scorecard, signal: scorecard ? positionSignal(scorecard, base) : null, error: scorecard ? null : "Not enough financial history yet." });
      } catch (error) {
        results.push({ ...base, scorecard: null, signal: null, error: error instanceof Error ? error.message : "Data unavailable." });
      }
    }
  }

  await Promise.all(Array.from({ length: 3 }, worker));
  results.sort((a, b) => b.currentValue - a.currentValue);

  const ratingCounts: Record<StockRating, number> = { strong: 0, good: 0, average: 0, weak: 0, avoid: 0 };
  let weighted = 0;
  let weightTotal = 0;

  for (const entry of results) {
    if (!entry.scorecard) continue;
    ratingCounts[entry.scorecard.rating] += 1;
    weighted += entry.scorecard.score * entry.currentValue;
    weightTotal += entry.currentValue;
  }

  return {
    modelVersion: MODEL_VERSION,
    holdings: results,
    ratingCounts,
    portfolioScore: weightTotal ? Math.round(weighted / weightTotal) : null,
  };
}

/** Cron helper: refresh stale fundamentals for every held symbol. */
export async function refreshResearchForSymbols(symbols: string[]) {
  let refreshed = 0;
  for (const symbol of [...new Set(symbols)]) {
    await getFundamentals(symbol).then(() => (refreshed += 1)).catch(() => null);
  }
  return refreshed;
}
