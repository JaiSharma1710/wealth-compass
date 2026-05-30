import { NextResponse } from "next/server";

import { getStockChart } from "@/lib/services/yahoo-finance.service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range")?.trim() || "1mo";
  const { symbol } = await context.params;

  try {
    const chart = await getStockChart(symbol, range);
    return NextResponse.json({ chart });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to load chart data.",
      },
      { status: 500 }
    );
  }
}
