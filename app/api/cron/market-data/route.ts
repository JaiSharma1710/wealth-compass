import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runCronMarketSync } from "@/lib/market-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

// Runs daily at 07:00 IST (see vercel.json): refreshes stock prices, MF NAVs and
// auto-priced gold, applies them without approval, and saves the net-worth snapshot.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const results = await runCronMarketSync();

  return NextResponse.json({
    message: "Market data synced.",
    userCount: results.length,
    results,
  });
}
