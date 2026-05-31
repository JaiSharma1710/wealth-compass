import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getExpenseBudgetStatus, upsertExpenseBudget } from "@/lib/expenses";

export const runtime = "nodejs";

type ExpenseBudgetBody = {
  amount?: number | string;
  startYear?: number | string;
  startMonth?: number | string;
};

function getTokenFromRequest(request: Request) {
  return request.headers.get("cookie")
    ? request.headers
      .get("cookie")
      ?.split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
      ?.split("=")[1]
    : null;
}

function parseOptionalInt(value: string | number | undefined) {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  try {
    const budget = await getExpenseBudgetStatus(session.sub, {
      startYear: parseOptionalInt(searchParams.get("startYear") || undefined),
      startMonth: parseOptionalInt(searchParams.get("startMonth") || undefined),
    });

    return NextResponse.json({ budget });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to load budget." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ExpenseBudgetBody | null;
  const amount =
    typeof body?.amount === "number" ? body.amount : Number(String(body?.amount || "").trim());

  try {
    const dashboard = await upsertExpenseBudget(session.sub, {
      amount,
      startYear: parseOptionalInt(body?.startYear),
      startMonth: parseOptionalInt(body?.startMonth),
    });

    return NextResponse.json({
      message: "Budget saved.",
      dashboard,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to save budget." },
      { status: 400 }
    );
  }
}
