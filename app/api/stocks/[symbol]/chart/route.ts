import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { getStockChart } from "@/lib/services/yahoo-finance.service";
import { getStockDetail } from "@/lib/stocks";

export const runtime = "nodejs";

const RANGES = new Set(["1mo", "6mo", "1y", "5y"]);

// Market price history from Yahoo; falls back to the prices synced into the app.
export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { symbol } = await context.params;
  const requested = new URL(request.url).searchParams.get("range") || "6mo";
  const range = RANGES.has(requested) ? requested : "6mo";
  const decoded = decodeURIComponent(symbol);
  const market = await getStockChart(decoded, range).catch(() => []);

  if (market.length > 1) {
    return NextResponse.json({ chart: market, source: "market" });
  }

  try {
    const detail = await getStockDetail(session.sub, decoded);
    return NextResponse.json({ chart: detail.chart, source: "synced" });
  } catch {
    return NextResponse.json({ chart: [], source: "none" });
  }
}
