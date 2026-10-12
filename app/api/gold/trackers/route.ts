import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { saveDailyPortfolioValuesForUser } from "@/lib/dashboard";
import {
  deleteGoldTracker,
  listGoldTrackers,
  saveGoldTracker,
  suggestGoldTracker,
} from "@/lib/gold-tracking";

export const runtime = "nodejs";
export const maxDuration = 60;

async function getUserId(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));
  return session?.sub || null;
}

function errorResponse(error: unknown, fallback: string) {
  return NextResponse.json(
    { message: error instanceof Error ? error.message : fallback },
    { status: 400 }
  );
}

// GET            -> all trackers
// GET ?suggest=id -> suggested ticker, live price and units for a holding
export async function GET(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const holdingId = new URL(request.url).searchParams.get("suggest");

  try {
    if (holdingId) {
      return NextResponse.json({ suggestion: await suggestGoldTracker(userId, holdingId) });
    }

    return NextResponse.json({ trackers: await listGoldTrackers(userId) });
  } catch (error) {
    return errorResponse(error, "Unable to load gold price tracking.");
  }
}

export async function POST(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { holdingId?: string; symbol?: string; units?: number | string };
    await saveGoldTracker(userId, {
      holdingId: String(body.holdingId || ""),
      symbol: String(body.symbol || ""),
      units: Number(body.units),
    });
    await saveDailyPortfolioValuesForUser(userId).catch(() => null);

    return NextResponse.json({ trackers: await listGoldTrackers(userId) });
  } catch (error) {
    return errorResponse(error, "Unable to enable auto pricing.");
  }
}

export async function DELETE(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const holdingId = new URL(request.url).searchParams.get("holdingId") || "";
  await deleteGoldTracker(userId, holdingId);

  return NextResponse.json({ trackers: await listGoldTrackers(userId) });
}
