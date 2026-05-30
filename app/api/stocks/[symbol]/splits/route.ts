import { NextResponse } from "next/server";

import { getSplitHistory } from "@/lib/services/yahoo-finance.service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await context.params;

  try {
    const splits = await getSplitHistory(symbol);
    return NextResponse.json({ splits });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to load split history.",
      },
      { status: 500 }
    );
  }
}
