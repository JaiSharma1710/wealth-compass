import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";
import { isGeminiConfigured } from "@/lib/services/gemini.service";
import { analyzeStock } from "@/lib/stock-analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

/** AI research note for one holding (Gemini), cached per day. */
export async function POST(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  if (!isGeminiConfigured()) {
    return NextResponse.json({ message: "GEMINI_API_KEY is not configured." }, { status: 503 });
  }

  const { symbol } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { force?: boolean };

  try {
    const report = await analyzeStock(session.sub, decodeURIComponent(symbol), { force: Boolean(body.force) });
    return NextResponse.json({ report });
  } catch (error) {
    console.error("Stock analysis failed.", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Analysis failed." }, { status: 502 });
  }
}
