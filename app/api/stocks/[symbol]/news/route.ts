import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { getStockNews } from "@/lib/services/yahoo-finance.service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { symbol } = await context.params;
  const news = await getStockNews(decodeURIComponent(symbol)).catch(() => []);

  return NextResponse.json({ symbol, news });
}
