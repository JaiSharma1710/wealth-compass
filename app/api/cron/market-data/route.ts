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

  try {
    const results = await runCronMarketSync();
    const failureCount = results.filter((result) => "error" in result).length;
    const didEveryUserFail = results.length > 0 && failureCount === results.length;

    // A 500 when nobody synced makes the failure visible in Vercel's cron logs.
    return NextResponse.json(
      {
        message: didEveryUserFail
          ? "Market data sync failed for every active user."
          : failureCount
            ? "Market data sync completed with some user failures."
            : "Market data synced.",
        userCount: results.length,
        failureCount,
        results,
      },
      { status: didEveryUserFail ? 500 : 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to sync market data." },
      { status: 500 }
    );
  }
}
