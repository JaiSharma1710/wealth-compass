import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createCronMarketSyncBatches } from "@/lib/market-sync";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await createCronMarketSyncBatches();
    const didEveryUserFail = result.userCount > 0 && result.failureCount === result.userCount;

    return NextResponse.json(
      {
        message: didEveryUserFail
          ? "Market data sync failed for every active user."
          : result.failureCount
            ? "Market data sync completed with some user failures."
            : "Market data sync batches created.",
        ...result,
      },
      { status: didEveryUserFail ? 500 : 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to create market data sync batches.",
      },
      { status: 500 }
    );
  }
}
