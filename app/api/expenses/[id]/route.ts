import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { deleteExpenseEntry, updateExpenseEntry } from "@/lib/expenses";
import type { ExpenseEntryType } from "@/lib/expenses.types";

export const runtime = "nodejs";

type ExpenseUpdateBody = {
  entryType?: ExpenseEntryType;
  amount?: number | string;
  note?: string;
  category?: string;
  occurredAt?: string;
};

function getTokenFromRequest(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

function statusFor(error: unknown) {
  return error instanceof Error && error.message === "Entry not found." ? 404 : 400;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as ExpenseUpdateBody | null;
  const amount =
    typeof body?.amount === "number" ? body.amount : Number(String(body?.amount || "").trim());

  try {
    const dashboard = await updateExpenseEntry(session.sub, id, {
      entryType: body?.entryType as ExpenseEntryType,
      amount,
      note: body?.note,
      category: body?.category,
      occurredAt: String(body?.occurredAt || ""),
    });

    return NextResponse.json({ message: "Entry updated.", dashboard });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update entry." },
      { status: statusFor(error) }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const dashboard = await deleteExpenseEntry(session.sub, id);

    return NextResponse.json({ message: "Entry deleted.", dashboard });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to delete entry." },
      { status: statusFor(error) }
    );
  }
}
