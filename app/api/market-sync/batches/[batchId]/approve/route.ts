import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { approveMarketSyncBatchItems } from "@/lib/market-sync";

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
  const body = (await request.json().catch(() => null)) as { itemIds?: string[] } | null;

  try {
    const batch = await approveMarketSyncBatchItems({
      userId: session.sub,
      batchId,
      itemIds: Array.isArray(body?.itemIds) ? body.itemIds : null,
    });

    return NextResponse.json({ batch });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to approve rows." },
      { status: 400 }
    );
  }
}
