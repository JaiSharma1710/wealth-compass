import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/mongodb";
import { CashReserveEntry } from "@/lib/models/cash-reserve-entry";
import type {
  CashReserveBankDistribution,
  CashReserveDashboardData,
  CashReserveMonthSummary,
  CashReserveRecentActivityFilters,
  CashReserveRecentActivityPage,
} from "@/lib/cash-reserves.types";

const RECENT_ACTIVITY_PAGE_SIZE = 10;

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

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

async function getRecentActivityAvailableYears(userId: string) {
  const years = await CashReserveEntry.aggregate<{ _id: number }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: {
          $year: "$entryDate",
        },
      },
    },
    {
      $sort: {
        _id: -1,
      },
    },
  ]);

  return years.map((entry) => entry._id);
}

export async function getCashReserveRecentActivity(
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
    month?: number | null;
    year?: number | null;
    date?: string | null;
    entryType?: CashReserveRecentActivityFilters["entryType"];
  }
): Promise<CashReserveRecentActivityPage> {
  await connectToDatabase();

  const pageSize = Math.min(Math.max(options?.pageSize || RECENT_ACTIVITY_PAGE_SIZE, 1), RECENT_ACTIVITY_PAGE_SIZE);
  const page = Math.max(options?.page || 1, 1);
  const month =
    typeof options?.month === "number" && options.month >= 1 && options.month <= 12
      ? options.month
      : null;
  const year =
    typeof options?.year === "number" && options.year >= 1900 && options.year <= 9999
      ? options.year
      : null;
  const entryType =
    options?.entryType === "credit" || options?.entryType === "debit"
      ? options.entryType
      : "all";
  const date = options?.date?.trim() || null;
  const parsedDate = date ? parseDateOnly(date) : null;
  const query: Record<string, unknown> = { userId };

  if (entryType !== "all") {
    query.entryType = entryType;
  }

  if (parsedDate) {
    query.entryDate = {
      $gte: startOfDay(parsedDate),
      $lt: endOfDay(parsedDate),
    };
  } else if (year && month) {
    query.entryDate = {
      $gte: new Date(year, month - 1, 1),
      $lt: new Date(year, month, 1),
    };
  } else if (year) {
    query.entryDate = {
      $gte: new Date(year, 0, 1),
      $lt: new Date(year + 1, 0, 1),
    };
  } else if (month) {
    query.$expr = {
      $eq: [{ $month: "$entryDate" }, month],
    };
  }

  const [entries, totalCount, availableYears] = await Promise.all([
    CashReserveEntry.find(query)
      .sort({ entryDate: -1, createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    CashReserveEntry.countDocuments(query),
    getRecentActivityAvailableYears(userId),
  ]);

  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;
  const safePage = Math.min(page, totalPages);
  const normalizedEntries =
    safePage === page
      ? entries
      : await CashReserveEntry.find(query)
          .sort({ entryDate: -1, createdAt: -1 })
          .skip((safePage - 1) * pageSize)
          .limit(pageSize)
          .lean();

  return {
    entries: normalizedEntries.map((entry) => ({
      id: String(entry._id),
      date: new Date(entry.entryDate).toISOString(),
      amount: roundCurrency(entry.amount),
      entryType: entry.entryType,
      bank: entry.bank || "Unassigned",
      note: entry.note || "",
    })),
    page: safePage,
    pageSize,
    totalCount,
    totalPages,
    filters: {
      month,
      year,
      date: parsedDate ? date : null,
      entryType,
    },
    availableYears,
  };
}

export async function getCashReserveDashboard(userId: string): Promise<CashReserveDashboardData> {
  await connectToDatabase();

  const entries = await CashReserveEntry.find({ userId })
    .sort({ entryDate: 1, createdAt: 1 })
    .lean();

  const monthStarts = getMonthStarts(6);
  const windowStart = monthStarts[0];
  const monthMap = new Map<string, { credits: number; debits: number; net: number }>();
  const bankMap = new Map<string, number>();
  let openingBalance = 0;

  for (const entry of entries) {
    const entryDate = new Date(entry.entryDate);
    const signedAmount = entry.entryType === "credit" ? entry.amount : -entry.amount;
    const bank = entry.bank || "Unassigned";

    bankMap.set(bank, (bankMap.get(bank) || 0) + signedAmount);

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
  const distributionDenominator = Math.abs(totalBalance);
  const bankDistribution: CashReserveBankDistribution[] = Array.from(bankMap.entries())
    .map(([bank, balance]) => ({
      bank,
      balance: roundCurrency(balance),
      percentage:
        distributionDenominator > 0
          ? roundCurrency((Math.abs(balance) / distributionDenominator) * 100)
          : 0,
    }))
    .filter((entry) => entry.balance !== 0)
    .sort((first, second) => Math.abs(second.balance) - Math.abs(first.balance));

  const recentActivity = await getCashReserveRecentActivity(userId, {
    page: 1,
    pageSize: RECENT_ACTIVITY_PAGE_SIZE,
  });

  return {
    totalBalance,
    monthOverMonthChangePct,
    monthOverMonthChangeAmount,
    bankDistribution,
    months,
    recentActivity,
  };
}
