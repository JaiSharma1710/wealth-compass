import { NextResponse } from "next/server";

import stockMap from "@/constants/stock-map.json";
import type { StockSearchResult } from "@/lib/stocks.types";

export const runtime = "nodejs";

function resolveQuoteType(companyName: string): "EQUITY" | "ETF" {
  const normalizedName = companyName.toUpperCase();

  return normalizedName.includes("ETF") ||
    normalizedName.includes("MUTUAL FUND") ||
    normalizedName.includes("FUND HOUSE")
    ? "ETF"
    : "EQUITY";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";

  if (!query) {
    return NextResponse.json({ options: [] });
  }

  try {
    const normalizedQuery = query.toLowerCase();
    const options = (stockMap as Array<{
      exchange: string;
      companyName: string;
      symbol: string;
      yahooSymbol: string;
    }>)
      .filter((entry) =>
        entry.symbol.toLowerCase().includes(normalizedQuery) ||
        entry.yahooSymbol.toLowerCase().includes(normalizedQuery) ||
        entry.companyName.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 15)
      .map(
        (entry): StockSearchResult => ({
          symbol: entry.yahooSymbol,
          exchange: entry.exchange,
          companyName: entry.companyName,
          shortName: entry.symbol,
          quoteType: resolveQuoteType(entry.companyName),
          sector: null,
          industry: null,
        })
      );

    return NextResponse.json({ options });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to search stocks.",
      },
      { status: 500 }
    );
  }
}
