import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, getAuthCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });

  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...getAuthCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}
