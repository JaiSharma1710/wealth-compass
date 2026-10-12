import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { fetchSovereignGoldBonds } from "@/lib/services/nse-sgb.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const bonds = await fetchSovereignGoldBonds();
    return NextResponse.json({ bonds });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to load sovereign gold bonds.",
      },
      { status: 502 }
    );
  }
}
