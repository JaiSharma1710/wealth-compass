import { NextResponse } from "next/server";

import { getStockNews } from "@/lib/services/yahoo-finance.service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await context.params;

  try {
    const news = await getStockNews(symbol);
    return NextResponse.json({ news });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to load news.",
      },
      { status: 500 }
    );
  }
}
