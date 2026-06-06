import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createCronMarketSyncBatches } from "@/lib/market-sync";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const batches = await createCronMarketSyncBatches();

  return NextResponse.json({
    message: "Market data sync batches created.",
    batchCount: batches.length,
    batches,
  });
}
