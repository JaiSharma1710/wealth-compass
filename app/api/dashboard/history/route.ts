import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { getPortfolioHistory } from "@/lib/dashboard";
import { DASHBOARD_HISTORY_RANGES, type DashboardHistoryRange } from "@/lib/dashboard.types";

export const runtime = "nodejs";

function parseRange(value: string | null): DashboardHistoryRange {
  return DASHBOARD_HISTORY_RANGES.includes((value || "").toUpperCase() as DashboardHistoryRange)
    ? ((value || "").toUpperCase() as DashboardHistoryRange)
    : "1M";
}

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = parseRange(searchParams.get("range"));
  const history = await getPortfolioHistory(session.sub, range);

  return NextResponse.json({ range, history });
}
