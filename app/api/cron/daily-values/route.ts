import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { saveDailyPortfolioValuesForUser } from "@/lib/dashboard";
import { syncSovereignGoldBondValuesForUser } from "@/lib/gold";
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
  const failures = [];

  for (const user of users) {
    const userId = String(user._id);

    try {
      const goldSync = await syncSovereignGoldBondValuesForUser(userId);
      const result = await saveDailyPortfolioValuesForUser(userId);
      results.push({
        userId,
        date: result.date,
        totalCurrentWorth: result.summary.totalCurrentWorth,
        sovereignGoldBondSync: goldSync,
      });
    } catch (error) {
      failures.push({
        userId,
        message:
          error instanceof Error ? error.message : "Unable to save daily portfolio values.",
      });
      console.error("Daily values cron failed for user.", { userId, error });
    }
  }

  return NextResponse.json({
    message: failures.length
      ? "Daily portfolio values completed with some user failures."
      : "Daily portfolio values saved.",
    userCount: users.length,
    savedCount: results.length,
    failureCount: failures.length,
    results,
    failures,
  });
}
