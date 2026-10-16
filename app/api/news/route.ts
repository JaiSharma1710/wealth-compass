import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { getNewsForStock, type NewsItem } from "@/lib/stock-news";
import { getStockDashboard } from "@/lib/stocks";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Headlines for every held stock (or ?symbol= one), newest first. */
export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const only = new URL(request.url).searchParams.get("symbol");
  const dashboard = await getStockDashboard(session.sub);
  const holdings = dashboard.holdings.filter((holding) => !only || holding.symbol === only);
  const queue = [...holdings];
  const items: NewsItem[] = [];

  async function worker() {
    for (let holding = queue.shift(); holding; holding = queue.shift()) {
      items.push(...(await getNewsForStock(holding.symbol, holding.companyName).catch(() => [])));
    }
  }

  await Promise.all(Array.from({ length: 4 }, worker));
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return NextResponse.json({
    items,
    stocks: holdings.map((holding) => ({ symbol: holding.symbol, name: holding.companyName })),
  });
}
