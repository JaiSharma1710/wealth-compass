import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, buildPublicUser, verifyAuthToken } from "@/lib/auth";
import { createGoal, deleteGoal, getGoalsPageData, updateGoal } from "@/lib/goals";
import type { GoalAssetType, GoalLinkInput } from "@/lib/goals.types";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

type GoalCreateBody = {
  name?: string;
  note?: string;
  targetAmount?: number | string;
  targetDate?: string;
  links?: GoalLinkInput[];
  /** Legacy single-link shape. */
  assetType?: GoalAssetType;
  investmentId?: string;
};

function toSaveInput(body: GoalCreateBody | null) {
  const targetAmount =
    typeof body?.targetAmount === "number"
      ? body.targetAmount
      : Number(String(body?.targetAmount || "").trim());
  const links =
    body?.links ??
    (body?.assetType && body?.investmentId
      ? [{ assetType: body.assetType, investmentId: body.investmentId }]
      : []);

  return {
    name: body?.name || "",
    note: body?.note || "",
    targetAmount,
    targetDate: body?.targetDate || "",
    links,
  };
}

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

  try {
    await createGoal(user, toSaveInput(body));
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

export async function PATCH(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as (GoalCreateBody & { id?: string }) | null;

  try {
    await updateGoal(user, String(body?.id || ""), toSaveInput(body));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update goal." },
      { status: 400 }
    );
  }

  const data = await getGoalsPageData(user);

  return NextResponse.json({ message: "Goal updated.", ...data });
}
