import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import {
  getMutualFundDashboard,
  saveMutualFundTransaction,
} from "@/lib/mutual-funds";

export const runtime = "nodejs";

type MutualFundTransactionBody = {
  schemeCode?: number | string;
  schemeName?: string;
  transactionType?: "buy" | "sell";
  units?: number | string;
  nav?: number | string;
  date?: string;
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

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const dashboard = await getMutualFundDashboard(session.sub);

  return NextResponse.json({ dashboard });
}

export async function POST(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as MutualFundTransactionBody | null;
  const schemeCode = Number(String(body?.schemeCode || "").trim());
  const schemeName = body?.schemeName?.trim() || "";
  const transactionType = body?.transactionType;
  const units = Number(String(body?.units || "").trim());
  const nav = Number(String(body?.nav || "").trim());
  const date = body?.date?.trim() || "";

  if (!Number.isFinite(schemeCode) || schemeCode <= 0) {
    return NextResponse.json(
      { message: "Please choose a valid mutual fund." },
      { status: 400 }
    );
  }

  if (!schemeName) {
    return NextResponse.json(
      { message: "Mutual fund name is required." },
      { status: 400 }
    );
  }

  if (transactionType !== "buy" && transactionType !== "sell") {
    return NextResponse.json(
      { message: "Please choose either buy or sell." },
      { status: 400 }
    );
  }

  try {
    await saveMutualFundTransaction(session.sub, {
      schemeCode,
      schemeName,
      transactionType,
      units,
      nav,
      date,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to save mutual fund transaction.",
      },
      { status: 400 }
    );
  }

  const dashboard = await getMutualFundDashboard(session.sub);

  return NextResponse.json(
    {
      message:
        transactionType === "buy"
          ? "Mutual fund purchase saved."
          : "Mutual fund sale saved.",
      dashboard,
    },
    { status: 201 }
  );
}
