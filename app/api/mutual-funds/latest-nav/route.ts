import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getMutualFundLatestNav } from "@/lib/mutual-funds";

export const runtime = "nodejs";

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

  const { searchParams } = new URL(request.url);
  const schemeCode = Number(searchParams.get("schemeCode") || "");

  if (!Number.isFinite(schemeCode) || schemeCode <= 0) {
    return NextResponse.json(
      { message: "Please choose a valid mutual fund." },
      { status: 400 }
    );
  }

  const latestNav = await getMutualFundLatestNav(schemeCode);

  if (latestNav == null) {
    return NextResponse.json(
      { message: "Unable to load the latest NAV right now." },
      { status: 404 }
    );
  }

  return NextResponse.json({ latestNav });
}
