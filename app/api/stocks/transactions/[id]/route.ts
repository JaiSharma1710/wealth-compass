import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { runMarketSync } from "@/lib/market-sync";
import { deleteStockTransaction, getStockDashboard } from "@/lib/stocks";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteStockTransaction(session.sub, id);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to delete transaction." },
      { status: 400 }
    );
  }

  // Re-value remaining positions and refresh today's net-worth snapshot.
  await runMarketSync({ userId: session.sub, assetType: "stock", source: "manual" }).catch(() => null);

  return NextResponse.json({
    message: "Transaction deleted.",
    dashboard: await getStockDashboard(session.sub),
  });
}
