import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { saveDailyPortfolioValuesForUser } from "@/lib/dashboard";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  await connectToDatabase();

  const users = await User.find({ status: "active" }).select({ _id: 1 }).lean();
  const results = [];

  for (const user of users) {
    const result = await saveDailyPortfolioValuesForUser(String(user._id));
    results.push({
      userId: String(user._id),
      date: result.date,
      totalCurrentWorth: result.summary.totalCurrentWorth,
    });
  }

  return NextResponse.json({
    message: "Daily portfolio values saved.",
    userCount: results.length,
    results,
  });
}
