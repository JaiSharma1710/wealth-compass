import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { getStockQuote } from "@/lib/services/yahoo-finance.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim() || "";

  if (!symbol) {
    return NextResponse.json({ message: "Stock symbol is required." }, { status: 400 });
  }

  try {
    const quote = await getStockQuote(symbol);

    if (!quote?.regularMarketPrice) {
      return NextResponse.json(
        { message: "Latest stock price is unavailable right now." },
        { status: 404 }
      );
    }

    return NextResponse.json({ quote });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to fetch latest stock price.",
      },
      { status: 502 }
    );
  }
}
