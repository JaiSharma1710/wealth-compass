import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { getPortfolioResearch } from "@/lib/stock-research";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Model scorecards + position signals for every stock you hold. */
export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  return NextResponse.json({ research: await getPortfolioResearch(session.sub) });
}
