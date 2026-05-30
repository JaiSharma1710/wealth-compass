import { NextResponse } from "next/server";

import { getBulkQuotes } from "@/lib/services/yahoo-finance.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSymbols = searchParams.get("symbols")?.trim() || "";
  const symbols = rawSymbols
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!symbols.length) {
    return NextResponse.json({ quotes: {} });
  }

  try {
    const quotes = await getBulkQuotes(symbols);
    return NextResponse.json({ quotes });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to load quotes.",
      },
      { status: 500 }
    );
  }
}
