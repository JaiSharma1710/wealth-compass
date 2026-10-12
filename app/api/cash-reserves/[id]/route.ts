import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import {
  CashReserveChangeError,
  deleteCashReserveEntry,
  getCashReserveDashboard,
  updateCashReserveEntry,
} from "@/lib/cash-reserves";
import { saveDailyPortfolioValuesForUser } from "@/lib/dashboard";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function getTokenFromRequest(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

function isDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return false;

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return !Number.isNaN(parsed.getTime()) && parsed <= new Date();
}

function fail(error: unknown) {
  if (error instanceof CashReserveChangeError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ message: "Could not update the entry." }, { status: 500 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await verifyAuthToken(getTokenFromRequest(request) ?? null);

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    date?: string;
    amount?: number | string;
    entryType?: string;
    bank?: string;
    note?: string;
  } | null;
  const date = body?.date?.trim() || "";
  const bank = body?.bank?.trim() || "";
  const note = body?.note?.trim() || "";
  const amount = typeof body?.amount === "number" ? body.amount : Number(String(body?.amount ?? "").trim());

  if (!isDateKey(date)) {
    return NextResponse.json({ message: "Please provide a valid date (not in the future)." }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "Amount must be greater than zero." }, { status: 400 });
  }

  if (body?.entryType !== "credit" && body?.entryType !== "debit") {
    return NextResponse.json({ message: "Please select either credit or debit." }, { status: 400 });
  }

  if (note.length > 500) {
    return NextResponse.json({ message: "Note must be 500 characters or fewer." }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findById(session.sub).lean();
  const banks = Array.isArray(user?.profile?.banks) ? user.profile.banks : [];

  if (!bank || !banks.includes(bank)) {
    return NextResponse.json({ message: "Please select a bank from your Settings profile." }, { status: 400 });
  }

  try {
    await updateCashReserveEntry(session.sub, id, {
      dateKey: date,
      amount,
      entryType: body.entryType,
      bank,
      note,
    });
    await saveDailyPortfolioValuesForUser(session.sub).catch(() => undefined);
  } catch (error) {
    return fail(error);
  }

  return NextResponse.json({ message: "Entry updated.", dashboard: await getCashReserveDashboard(session.sub) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await verifyAuthToken(getTokenFromRequest(request) ?? null);

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await deleteCashReserveEntry(session.sub, id);
    await saveDailyPortfolioValuesForUser(session.sub).catch(() => undefined);
  } catch (error) {
    return fail(error);
  }

  return NextResponse.json({ message: "Entry deleted.", dashboard: await getCashReserveDashboard(session.sub) });
}
