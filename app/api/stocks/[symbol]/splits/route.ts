import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await context.params;

  return NextResponse.json({
    symbol,
    splits: [],
    message: "Splits are not fetched live in the DB-first portfolio view.",
  });
}
