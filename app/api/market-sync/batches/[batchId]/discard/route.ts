import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { discardMarketSyncBatch } from "@/lib/market-sync";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { batchId } = await context.params;

  try {
    const batch = await discardMarketSyncBatch({
      userId: session.sub,
      batchId,
    });

    return NextResponse.json({ batch, message: "Market sync batch discarded." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to discard batch." },
      { status: 400 }
    );
  }
}
