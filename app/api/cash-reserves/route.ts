import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getCashReserveDashboard } from "@/lib/cash-reserves";
import { connectToDatabase } from "@/lib/mongodb";
import { CashReserveEntry } from "@/lib/models/cash-reserve-entry";

export const runtime = "nodejs";

type CashReserveCreateBody = {
  date?: string;
  amount?: number | string;
  entryType?: "credit" | "debit";
};

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const dashboard = await getCashReserveDashboard(session.sub);

  return NextResponse.json({ dashboard });
}

export async function POST(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CashReserveCreateBody | null;
  const date = body?.date?.trim() || "";
  const entryType = body?.entryType;
  const amountValue =
    typeof body?.amount === "number" ? body.amount : Number(String(body?.amount || "").trim());

  const entryDate = parseDateOnly(date);

  if (!entryDate) {
    return NextResponse.json({ message: "Please provide a valid date." }, { status: 400 });
  }

  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return NextResponse.json(
      { message: "Amount must be greater than zero." },
      { status: 400 }
    );
  }

  if (entryType !== "credit" && entryType !== "debit") {
    return NextResponse.json(
      { message: "Please select either credit or debit." },
      { status: 400 }
    );
  }

  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (entryDate > todayDateOnly) {
    return NextResponse.json(
      { message: "Future-dated entries are not allowed." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  await CashReserveEntry.create({
    userId: session.sub,
    entryDate,
    amount: Math.round(amountValue * 100) / 100,
    entryType,
  });

  const dashboard = await getCashReserveDashboard(session.sub);

  return NextResponse.json(
    {
      message: "Cash reserve entry added.",
      dashboard,
    },
    { status: 201 }
  );
}
