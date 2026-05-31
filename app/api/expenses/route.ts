import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getExpenseDashboard, saveExpenseEntry } from "@/lib/expenses";
import type { ExpenseEntryType } from "@/lib/expenses.types";

export const runtime = "nodejs";

type ExpenseCreateBody = {
  entryType?: ExpenseEntryType;
  amount?: number | string;
  note?: string;
  occurredAt?: string;
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

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dashboard = await getExpenseDashboard(session.sub, {
    page: parsePositiveInt(searchParams.get("page"), 1),
  });

  return NextResponse.json({ dashboard });
}

export async function POST(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ExpenseCreateBody | null;
  const amount =
    typeof body?.amount === "number" ? body.amount : Number(String(body?.amount || "").trim());

  try {
    const dashboard = await saveExpenseEntry(session.sub, {
      entryType: body?.entryType as ExpenseEntryType,
      amount,
      note: body?.note,
      occurredAt: String(body?.occurredAt || ""),
    });

    return NextResponse.json(
      {
        message: body?.entryType === "credit" ? "Credit added." : "Expense added.",
        dashboard,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to save entry." },
      { status: 400 }
    );
  }
}
