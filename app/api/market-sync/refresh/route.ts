import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { createMarketSyncBatch, type MarketSyncRefreshAssetType } from "@/lib/market-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { assetType?: MarketSyncRefreshAssetType }
    | null;
  const assetType = body?.assetType || "mixed";

  if (assetType !== "stock" && assetType !== "mutual_fund" && assetType !== "mixed") {
    return NextResponse.json({ message: "Invalid refresh asset type." }, { status: 400 });
  }

  try {
    const batch = await createMarketSyncBatch({
      userId: session.sub,
      assetType,
      source: "manual",
    });

    return NextResponse.json({ batch });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to refresh market data." },
      { status: 500 }
    );
  }
}
