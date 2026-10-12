import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { getPortfolioHistory } from "@/lib/dashboard";
import { filterHistoryByRange, getAvailableHistoryRanges } from "@/lib/dashboard-calculations";
import { DASHBOARD_HISTORY_RANGES, type DashboardHistoryRange } from "@/lib/dashboard.types";

export const runtime = "nodejs";

const CHART_HISTORY_RANGES: DashboardHistoryRange[] = ["1M", "3M", "6M", "1Y", "ALL"];

function parseRange(value: string | null): DashboardHistoryRange {
  return DASHBOARD_HISTORY_RANGES.includes((value || "").toUpperCase() as DashboardHistoryRange)
    ? ((value || "").toUpperCase() as DashboardHistoryRange)
    : "ALL";
}

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = parseRange(searchParams.get("range"));
  const allHistory = await getPortfolioHistory(session.sub, "ALL");
  const historyAvailableRanges = getAvailableHistoryRanges(allHistory, {
    ranges: CHART_HISTORY_RANGES,
  });
  const safeRange = historyAvailableRanges.includes(range)
    ? range
    : historyAvailableRanges[0] || range;
  const history = filterHistoryByRange(allHistory, safeRange);

  return NextResponse.json({ range: safeRange, history, historyAvailableRanges });
}
