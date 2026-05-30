import { NextResponse } from "next/server";

import { verifyAuthToken } from "@/lib/auth";
import { getTokenFromRequest } from "@/lib/api-auth";
import { getStockDashboard } from "@/lib/stocks";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const dashboard = await getStockDashboard(session.sub);
  return NextResponse.json({ dashboard });
}
