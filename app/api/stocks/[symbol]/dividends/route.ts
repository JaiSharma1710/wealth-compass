import { NextResponse } from "next/server";

import { getDividendHistory } from "@/lib/services/yahoo-finance.service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await context.params;

  try {
    const dividends = await getDividendHistory(symbol);
    return NextResponse.json({ dividends });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to load dividends.",
      },
      { status: 500 }
    );
  }
}
