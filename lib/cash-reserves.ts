import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { CashReserveEntry } from "@/lib/models/cash-reserve-entry";
import type {
  CashReserveDashboardData,
  CashReserveEntrySummary,
  CashReserveMonthSummary,
} from "@/lib/cash-reserves.types";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getMonthStarts(count: number) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return Array.from({ length: count }, (_, index) => {
    return new Date(
      currentMonthStart.getFullYear(),
      currentMonthStart.getMonth() - (count - 1 - index),
      1
    );
  });
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
  }).format(date);
}

export async function getCashReserveDashboard(userId: string): Promise<CashReserveDashboardData> {
  await connectToDatabase();

  const entries = await CashReserveEntry.find({ userId })
    .sort({ entryDate: 1, createdAt: 1 })
    .lean();

  const monthStarts = getMonthStarts(6);
  const windowStart = monthStarts[0];
  const monthMap = new Map<string, { credits: number; debits: number; net: number }>();
  let openingBalance = 0;

  for (const entry of entries) {
    const entryDate = new Date(entry.entryDate);
    const signedAmount = entry.entryType === "credit" ? entry.amount : -entry.amount;

    if (entryDate < windowStart) {
      openingBalance += signedAmount;
      continue;
    }

    const key = monthKey(entryDate);
    const current = monthMap.get(key) || { credits: 0, debits: 0, net: 0 };

    if (entry.entryType === "credit") {
      current.credits += entry.amount;
    } else {
      current.debits += entry.amount;
    }

    current.net += signedAmount;
    monthMap.set(key, current);
  }

  let runningBalance = openingBalance;
  const months: CashReserveMonthSummary[] = monthStarts.map((start) => {
    const key = monthKey(start);
    const bucket = monthMap.get(key) || { credits: 0, debits: 0, net: 0 };

    runningBalance += bucket.net;

    return {
      key,
      label: getMonthLabel(start),
      credits: roundCurrency(bucket.credits),
      debits: roundCurrency(bucket.debits),
      net: roundCurrency(bucket.net),
      closingBalance: roundCurrency(runningBalance),
    };
  });

  const totalBalance = months.length
    ? months[months.length - 1].closingBalance
    : roundCurrency(openingBalance);
  const previousMonthBalance =
    months.length > 1 ? months[months.length - 2].closingBalance : roundCurrency(openingBalance);
  const monthOverMonthChangeAmount = roundCurrency(totalBalance - previousMonthBalance);
  const monthOverMonthChangePct =
    previousMonthBalance === 0
      ? totalBalance === 0
        ? 0
        : 100
      : roundCurrency((monthOverMonthChangeAmount / Math.abs(previousMonthBalance)) * 100);

  const recentEntries: CashReserveEntrySummary[] = [...entries]
    .sort((left, right) => {
      return (
        new Date(right.entryDate).getTime() - new Date(left.entryDate).getTime()
      );
    })
    .slice(0, 8)
    .map((entry) => ({
      id: String(entry._id),
      date: new Date(entry.entryDate).toISOString(),
      amount: roundCurrency(entry.amount),
      entryType: entry.entryType,
    }));

  return {
    totalBalance,
    monthOverMonthChangePct,
    monthOverMonthChangeAmount,
    months,
    recentEntries,
  };
}
