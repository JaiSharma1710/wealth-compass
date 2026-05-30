import { NextResponse } from "next/server";

import { getStockInsights } from "@/lib/services/yahoo-finance.service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await context.params;

  try {
    const insights = await getStockInsights(symbol);
    return NextResponse.json({ insights });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to load insights.",
      },
      { status: 500 }
    );
  }
}
