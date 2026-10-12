import { NextResponse } from "next/server";

import { createAccount, deleteAccount, getAccountsDashboard, updateAccount } from "@/lib/accounts";
import type { SaveAccountInput } from "@/lib/accounts.types";
import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { saveDailyPortfolioValuesForUser } from "@/lib/dashboard";

export const runtime = "nodejs";

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

async function respondWithDashboard(userId: string) {
  // Keep today's net-worth snapshot in step with the change.
  await saveDailyPortfolioValuesForUser(userId).catch(() => null);
  return NextResponse.json({ dashboard: await getAccountsDashboard(userId) });
}

export async function GET(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ dashboard: await getAccountsDashboard(userId) });
}

export async function POST(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SaveAccountInput;
    await createAccount(userId, body);
    return respondWithDashboard(userId);
  } catch (error) {
    return errorResponse(error, "Unable to save account.");
  }
}

export async function PATCH(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SaveAccountInput & { id?: string };
    await updateAccount(userId, String(body.id || ""), body);
    return respondWithDashboard(userId);
  } catch (error) {
    return errorResponse(error, "Unable to update account.");
  }
}

export async function DELETE(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    await deleteAccount(userId, id);
    return respondWithDashboard(userId);
  } catch (error) {
    return errorResponse(error, "Unable to delete account.");
  }
}
