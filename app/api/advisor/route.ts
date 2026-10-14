import { NextResponse } from "next/server";

import { getAdvisorReport, saveAdvisorProfile } from "@/lib/advisor";
import { getTokenFromRequest } from "@/lib/api-auth";
import { buildPublicUser, verifyAuthToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";
import { isGeminiConfigured } from "@/lib/services/gemini.service";

export const runtime = "nodejs";
export const maxDuration = 60;

async function getRequestUser(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) return null;

  await connectToDatabase();
  const user = await User.findById(session.sub).lean();
  return user ? buildPublicUser(user) : null;
}

async function respondWithReport(request: Request, force: boolean) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json({ message: "Add GEMINI_API_KEY to enable the AI advisor." }, { status: 503 });
  }

  try {
    return NextResponse.json({ report: await getAdvisorReport(user, { force }) });
  } catch (error) {
    console.error("Advisor generation failed.", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to generate advice." },
      { status: 502 }
    );
  }
}

/** Today's analysis (generated on first request of the day, then cached). */
export async function GET(request: Request) {
  return respondWithReport(request, false);
}

/** Re-analyse now (subject to a short cooldown). */
export async function POST(request: Request) {
  return respondWithReport(request, true);
}

/** Save income / risk profile used by the advisor. */
export async function PATCH(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { monthlyIncome?: number | string | null; riskProfile?: string };
    await saveAdvisorProfile(user, {
      monthlyIncome: body.monthlyIncome == null || body.monthlyIncome === "" ? null : Number(body.monthlyIncome),
      riskProfile: body.riskProfile,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to save profile." },
      { status: 400 }
    );
  }
}
