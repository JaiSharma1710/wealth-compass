import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getMutualFundNavHistory } from "@/lib/mutual-funds";

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
  const schemeName = searchParams.get("schemeName")?.trim() || undefined;

  if (!Number.isFinite(schemeCode) || schemeCode <= 0) {
    return NextResponse.json(
      { message: "Please choose a valid mutual fund." },
      { status: 400 }
    );
  }

  const history = await getMutualFundNavHistory(session.sub, schemeCode, schemeName);

  if (!history) {
    return NextResponse.json(
      { message: "Unable to load fund movement history." },
      { status: 404 }
    );
  }

  return NextResponse.json({ history });
}
