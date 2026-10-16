import { StockDetailView } from "@/components/stock-detail-view";
import { requireCurrentUser } from "@/lib/auth";
import { getCachedStockAnalysis } from "@/lib/stock-analysis";
import { getScorecard, positionSignal } from "@/lib/stock-research";
import { getStockDetail } from "@/lib/stocks";

export const dynamic = "force-dynamic";

const CRORE = 1e7;

async function loadResearch(userId: string, symbol: string, holding: { allocationPercent: number; unrealizedProfitPercent: number } | null) {
  try {
    const [{ fundamentals, scorecard }, reports] = await Promise.all([getScorecard(symbol), getCachedStockAnalysis(userId, symbol)]);
    return {
      scorecard,
      financials: fundamentals.annual.slice(-4).map((period) => ({
        period: period.date,
        revenue: period.totalRevenue != null ? Math.round(period.totalRevenue / CRORE) : null,
        netProfit: period.netIncome != null ? Math.round(period.netIncome / CRORE) : null,
      })),
      reports,
      signal: scorecard && holding ? positionSignal(scorecard, { weightPercent: holding.allocationPercent, returnsPercent: holding.unrealizedProfitPercent }) : null,
      error: scorecard ? null : "Not enough financial history for this company yet.",
    };
  } catch (error) {
    return { scorecard: null, financials: [], reports: [], signal: null, error: error instanceof Error ? error.message : "Research unavailable." };
  }
}

export default async function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const user = await requireCurrentUser();
  const { symbol } = await params;
  const detail = await getStockDetail(user.id, decodeURIComponent(symbol));
  const research = await loadResearch(user.id, detail.symbol, detail.activeHolding);

  return <StockDetailView currencyCode={user.profile.currency || "INR"} initialData={detail} research={research} />;
}
