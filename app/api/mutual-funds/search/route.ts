import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

export const runtime = "nodejs";

type MfApiSearchResult = {
  schemeCode: number;
  schemeName: string;
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

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json({ options: [] satisfies MfApiSearchResult[] });
  }

  const response = await fetch(
    `https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`,
    {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    }
  ).catch(() => null);

  if (!response?.ok) {
    return NextResponse.json(
      { message: "Unable to search mutual funds right now." },
      { status: 502 }
    );
  }

  const result = (await response.json().catch(() => null)) as MfApiSearchResult[] | null;

  return NextResponse.json({
    options: Array.isArray(result) ? result.slice(0, 10) : [],
  });
}
