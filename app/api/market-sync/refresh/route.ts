import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { runMarketSync, type MarketSyncRunAssetType } from "@/lib/market-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { assetType?: MarketSyncRunAssetType }
    | null;
  const assetType = body?.assetType || "mixed";

  if (!["stock", "mutual_fund", "gold", "mixed"].includes(assetType)) {
    return NextResponse.json({ message: "Invalid refresh asset type." }, { status: 400 });
  }

  try {
    const result = await runMarketSync({
      userId: session.sub,
      assetType,
      source: "manual",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to refresh market data." },
      { status: 500 }
    );
  }
}
