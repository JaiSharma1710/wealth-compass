import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { listMarketSyncBatches } from "@/lib/market-sync";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const batches = await listMarketSyncBatches({
    userId: session.sub,
    source: (searchParams.get("source") as "cron" | "manual" | "all" | null) || "all",
    status:
      (searchParams.get("status") as
        | "pending"
        | "partially_approved"
        | "approved"
        | "synced"
        | "discarded"
        | "error"
        | "all"
        | null) || "all",
    limit: Number(searchParams.get("limit") || 20),
  });

  return NextResponse.json({ batches });
}
