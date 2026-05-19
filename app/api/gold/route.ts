import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import {
  deleteGoldTransaction,
  getGoldDashboard,
  getGoldRecentActivity,
  saveGoldTransaction,
} from "@/lib/gold";
import type { GoldTransactionType } from "@/lib/gold.types";

export const runtime = "nodejs";

type GoldCreateBody = {
  transactionType?: GoldTransactionType;
  investmentOption?: string;
  schemeName?: string;
  date?: string;
  investedAmount?: number | string;
  currentValue?: number | string;
  sellAmount?: number | string;
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

function parseOptionalNumber(value: number | string | undefined) {
  if (typeof value === "number") {
    return value;
  }

  return Number(String(value || "").trim());
}

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activity = await getGoldRecentActivity(session.sub, {
    page: parsePositiveInt(searchParams.get("page"), 1),
    pageSize: parsePositiveInt(searchParams.get("pageSize"), 10),
  });
  const dashboard = await getGoldDashboard(session.sub);

  return NextResponse.json({ activity, dashboard });
}

export async function POST(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GoldCreateBody | null;
  const transactionType = body?.transactionType;

  if (
    transactionType !== "buy" &&
    transactionType !== "sell" &&
    transactionType !== "valuation"
  ) {
    return NextResponse.json(
      { message: "Please choose buy, sell, or valuation." },
      { status: 400 }
    );
  }

  try {
    await saveGoldTransaction(session.sub, {
      transactionType,
      investmentOption: body?.investmentOption || "",
      schemeName: body?.schemeName || "",
      date: body?.date || "",
      investedAmount: parseOptionalNumber(body?.investedAmount),
      currentValue: parseOptionalNumber(body?.currentValue),
      sellAmount: parseOptionalNumber(body?.sellAmount),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to save gold transaction.",
      },
      { status: 400 }
    );
  }

  const dashboard = await getGoldDashboard(session.sub);

  return NextResponse.json(
    {
      message:
        transactionType === "buy"
          ? "Gold purchase saved."
          : transactionType === "sell"
            ? "Gold sale saved."
            : "Gold current value updated.",
      dashboard,
    },
    { status: 201 }
  );
}

export async function DELETE(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get("transactionId")?.trim() || "";

  if (!transactionId) {
    return NextResponse.json(
      { message: "Transaction ID is required." },
      { status: 400 }
    );
  }

  try {
    await deleteGoldTransaction(session.sub, transactionId);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to delete gold transaction.",
      },
      { status: 400 }
    );
  }

  const dashboard = await getGoldDashboard(session.sub);

  return NextResponse.json({
    message: "Gold transaction deleted.",
    dashboard,
  });
}
