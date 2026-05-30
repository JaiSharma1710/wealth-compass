import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { buildPublicUser, verifyAuthToken } from "@/lib/auth";
import { refreshDashboard } from "@/lib/dashboard";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.sub).lean();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const dashboard = await refreshDashboard(buildPublicUser(user));
    return NextResponse.json({ dashboard });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not refresh dashboard values.",
      },
      { status: 500 }
    );
  }
}
