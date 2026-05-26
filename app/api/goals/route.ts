import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, buildPublicUser, verifyAuthToken } from "@/lib/auth";
import { createGoal, deleteGoal, getGoalsPageData } from "@/lib/goals";
import type { GoalAssetType } from "@/lib/goals.types";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

type GoalCreateBody = {
  name?: string;
  note?: string;
  targetAmount?: number | string;
  targetDate?: string;
  assetType?: GoalAssetType;
  investmentId?: string;
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

async function getRequestUser(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return null;
  }

  await connectToDatabase();
  const user = await User.findById(session.sub).lean();

  return user ? buildPublicUser(user) : null;
}

export async function GET(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const data = await getGoalsPageData(user);

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GoalCreateBody | null;
  const targetAmount =
    typeof body?.targetAmount === "number"
      ? body.targetAmount
      : Number(String(body?.targetAmount || "").trim());

  try {
    await createGoal(user, {
      name: body?.name || "",
      note: body?.note || "",
      targetAmount,
      targetDate: body?.targetDate || "",
      assetType: body?.assetType || "stock",
      investmentId: body?.investmentId || "",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create goal." },
      { status: 400 }
    );
  }

  const data = await getGoalsPageData(user);

  return NextResponse.json(
    {
      message: "Goal created.",
      ...data,
    },
    { status: 201 }
  );
}

export async function DELETE(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const goalId = searchParams.get("goalId")?.trim() || "";

  if (!goalId) {
    return NextResponse.json({ message: "Goal ID is required." }, { status: 400 });
  }

  try {
    await deleteGoal(user.id, goalId);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to delete goal." },
      { status: 400 }
    );
  }

  const data = await getGoalsPageData(user);

  return NextResponse.json({
    message: "Goal deleted.",
    ...data,
  });
}
