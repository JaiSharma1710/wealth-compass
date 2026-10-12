import { NextResponse } from "next/server";

import { runMarketSync } from "@/lib/market-sync";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { getStockDashboard, saveStockSellTransaction } from "@/lib/stocks";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    await saveStockSellTransaction(session.sub, {
      symbol: String(body?.symbol || "").trim(),
      quantity: Number(body?.quantity),
      price: Number(body?.price),
      brokerage: Number(body?.brokerage || 0),
      taxes: Number(body?.taxes || 0),
      charges: Number(body?.charges || 0),
      transactionDate: String(body?.transactionDate || "").trim(),
      note: String(body?.note || "").trim(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to save stock sale.",
      },
      { status: 400 }
    );
  }

  // Price the changed position right away and refresh today's net-worth snapshot.
  await runMarketSync({ userId: session.sub, assetType: "stock", source: "manual" }).catch(
    () => null
  );

  const dashboard = await getStockDashboard(session.sub);
  return NextResponse.json(
    {
      message: "Stock sale saved.",
      dashboard,
    },
    { status: 201 }
  );
}
