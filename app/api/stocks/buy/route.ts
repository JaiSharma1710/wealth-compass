import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { getStockDashboard, saveStockBuyTransaction } from "@/lib/stocks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    await saveStockBuyTransaction(session.sub, {
      symbol: String(body?.symbol || "").trim(),
      exchange: String(body?.exchange || "").trim(),
      companyName: String(body?.companyName || "").trim(),
      shortName: String(body?.shortName || "").trim(),
      sector: body?.sector == null ? null : String(body.sector).trim(),
      industry: body?.industry == null ? null : String(body.industry).trim(),
      currency: body?.currency == null ? null : String(body.currency).trim(),
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
        message:
          error instanceof Error ? error.message : "Unable to save stock purchase.",
      },
      { status: 400 }
    );
  }

  const dashboard = await getStockDashboard(session.sub);
  return NextResponse.json(
    {
      message: "Stock purchase saved.",
      dashboard,
    },
    { status: 201 }
  );
}
