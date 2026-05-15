import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/mongodb";
import { MutualFundMonthlySnapshot } from "@/lib/models/mutual-fund-monthly-snapshot";
import { MutualFundTransaction } from "@/lib/models/mutual-fund-transaction";
import type {
  MutualFundDashboardData,
  MutualFundMonthSummary,
  MutualFundNavHistory,
  MutualFundNavHistoryPoint,
  MutualFundTransactionSummary,
  MutualFundTransactionType,
} from "@/lib/mutual-funds.types";

type HoldingAccumulator = {
  schemeCode: number;
  schemeName: string;
  units: number;
  investedAmount: number;
  latestKnownNav: number;
};

type TransactionRecord = {
  _id: { toString(): string } | string;
  schemeCode: number;
  schemeName: string;
  transactionType: MutualFundTransactionType;
  units: number;
  nav: number;
  amount: number;
  averageBuyNav?: number | null;
  realizedCostBasisAmount?: number | null;
  realizedProfitAmount?: number | null;
  transactionDate: Date;
  createdAt?: Date;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getMonthStarts(count: number) {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);

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

function getMonthYearLabel(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "2-digit",
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

function parseMfApiDate(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatApiDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

async function fetchLatestNavForScheme(schemeCode: number) {
  const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const result = (await response.json().catch(() => null)) as
    | {
        data?: Array<{ nav?: string }>;
      }
    | null;

  const nav = Number(result?.data?.[0]?.nav || "");

  return Number.isFinite(nav) && nav > 0 ? roundCurrency(nav) : null;
}

async function fetchNavHistoryForScheme(schemeCode: number, startDate: string, endDate: string) {
  const response = await fetch(
    `https://api.mfapi.in/mf/${schemeCode}?startDate=${startDate}&endDate=${endDate}`,
    {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    }
  ).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  return (await response.json().catch(() => null)) as
    | {
        meta?: {
          scheme_name?: string;
          scheme_code?: number;
        };
        data?: Array<{
          date?: string;
          nav?: string;
        }>;
      }
    | null;
}

function normalizeHoldings(holdings: Map<number, HoldingAccumulator>) {
  return [...holdings.values()]
    .filter((holding) => holding.units > 0.000001)
    .map((holding) => {
      const units = roundCurrency(holding.units);
      const investedAmount = roundCurrency(Math.max(holding.investedAmount, 0));
      const averageNav = units ? roundCurrency(investedAmount / units) : 0;
      const currentNav = roundCurrency(holding.latestKnownNav);
      const currentValue = roundCurrency(units * currentNav);
      const profitLossAmount = roundCurrency(currentValue - investedAmount);
      const profitLossPct = investedAmount
        ? roundCurrency((profitLossAmount / investedAmount) * 100)
        : 0;

      return {
        schemeCode: holding.schemeCode,
        schemeName: holding.schemeName,
        units,
        investedAmount,
        averageNav,
        currentNav,
        currentValue,
        profitLossAmount,
        profitLossPct,
      };
    })
    .sort((left, right) => right.currentValue - left.currentValue);
}

function buildHoldingsFromTransactions(
  transactions: TransactionRecord[],
  cutoffDate?: Date
) {
  const holdings = new Map<number, HoldingAccumulator>();

  for (const transaction of transactions) {
    if (cutoffDate && transaction.transactionDate > cutoffDate) {
      break;
    }

    const current = holdings.get(transaction.schemeCode) || {
      schemeCode: transaction.schemeCode,
      schemeName: transaction.schemeName,
      units: 0,
      investedAmount: 0,
      latestKnownNav: transaction.nav,
    };

    current.schemeName = transaction.schemeName;
    current.latestKnownNav = transaction.nav;

    if (transaction.transactionType === "buy") {
      current.units += transaction.units;
      current.investedAmount += transaction.amount;
    } else {
      const averageNavBeforeSell =
        current.units > 0 ? current.investedAmount / current.units : 0;
      current.units -= transaction.units;
      current.investedAmount -= averageNavBeforeSell * transaction.units;
    }

    if (current.units <= 0.000001) {
      holdings.delete(transaction.schemeCode);
      continue;
    }

    if (current.investedAmount < 0.000001) {
      current.investedAmount = 0;
    }

    holdings.set(transaction.schemeCode, current);
  }

  return normalizeHoldings(holdings);
}

async function applyLiveCurrentNav(
  holdings: ReturnType<typeof buildHoldingsFromTransactions>
) {
  const liveNavPairs = await Promise.all(
    holdings.map(async (holding) => {
      const latestNav = await fetchLatestNavForScheme(holding.schemeCode);
      return [holding.schemeCode, latestNav] as const;
    })
  );
  const liveNavMap = new Map(liveNavPairs);

  return holdings.map((holding) => {
    const currentNav = liveNavMap.get(holding.schemeCode) || holding.currentNav;
    const currentValue = roundCurrency(holding.units * currentNav);
    const profitLossAmount = roundCurrency(currentValue - holding.investedAmount);
    const profitLossPct = holding.investedAmount
      ? roundCurrency((profitLossAmount / holding.investedAmount) * 100)
      : 0;

    return {
      ...holding,
      currentNav,
      currentValue,
      profitLossAmount,
      profitLossPct,
    };
  });
}

function mapHoldingsToSummary(holdings: Awaited<ReturnType<typeof applyLiveCurrentNav>>) {
  const totalPortfolioValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);

  return holdings.map((holding) => ({
    ...holding,
    allocationPct: totalPortfolioValue
      ? roundCurrency((holding.currentValue / totalPortfolioValue) * 100)
      : 0,
  }));
}

async function loadTransactions(userId: string) {
  await connectToDatabase();

  return (await MutualFundTransaction.find({ userId })
    .sort({ transactionDate: 1, createdAt: 1 })
    .lean()) as TransactionRecord[];
}

async function ensureSnapshotsUpToDate(userId: string, transactions?: TransactionRecord[]) {
  const allTransactions = transactions || (await loadTransactions(userId));

  if (!allTransactions.length) {
    return;
  }

  const firstMonth = startOfMonth(allTransactions[0].transactionDate);
  const currentMonth = startOfMonth(new Date());
  const objectUserId = new Types.ObjectId(userId);
  const snapshotWrites = [];

  for (
    const monthCursor = new Date(firstMonth);
    monthCursor <= currentMonth;
    monthCursor.setMonth(monthCursor.getMonth() + 1)
  ) {
    const snapshotDate = new Date(monthCursor);
    const holdings = buildHoldingsFromTransactions(allTransactions, endOfMonth(snapshotDate));
    const totalInvested = roundCurrency(
      holdings.reduce((sum, holding) => sum + holding.investedAmount, 0)
    );
    const totalValue = roundCurrency(
      holdings.reduce((sum, holding) => sum + holding.currentValue, 0)
    );

    snapshotWrites.push({
      updateOne: {
        filter: {
          userId: objectUserId,
          monthKey: monthKey(snapshotDate),
        },
        update: {
          $set: {
            userId: objectUserId,
            monthKey: monthKey(snapshotDate),
            year: snapshotDate.getFullYear(),
            month: snapshotDate.getMonth() + 1,
            totalInvested,
            totalValue,
            distribution: holdings,
          },
        },
        upsert: true,
      },
    });
  }

  if (snapshotWrites.length) {
    await MutualFundMonthlySnapshot.bulkWrite(
      snapshotWrites as Parameters<typeof MutualFundMonthlySnapshot.bulkWrite>[0]
    );
  }
}

export async function getMutualFundHoldingsOnDate(
  userId: string,
  schemeCode: number,
  date: Date
) {
  const transactions = await loadTransactions(userId);
  const holdings = buildHoldingsFromTransactions(transactions, endOfMonth(date));

  return holdings.find((holding) => holding.schemeCode === schemeCode) || null;
}

export async function saveMutualFundTransaction(
  userId: string,
  input: {
    schemeCode: number;
    schemeName: string;
    transactionType: MutualFundTransactionType;
    units: number;
    nav: number;
    date: string;
  }
) {
  const transactionDate = parseDateOnly(input.date);

  if (!transactionDate) {
    throw new Error("Please provide a valid date.");
  }

  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (transactionDate > todayDateOnly) {
    throw new Error("Future-dated entries are not allowed.");
  }

  const units = roundCurrency(input.units);
  const nav = roundCurrency(input.nav);

  if (!Number.isFinite(units) || units <= 0) {
    throw new Error("Units must be greater than zero.");
  }

  if (!Number.isFinite(nav) || nav <= 0) {
    throw new Error("NAV must be greater than zero.");
  }

  let averageBuyNav: number | null = null;
  let realizedCostBasisAmount: number | null = null;
  let realizedProfitAmount: number | null = null;

  if (input.transactionType === "sell") {
    const holding = await getMutualFundHoldingsOnDate(userId, input.schemeCode, transactionDate);

    if (!holding || holding.units < units) {
      throw new Error("You do not have enough units available to sell.");
    }

    averageBuyNav = roundCurrency(holding.averageNav);
    realizedCostBasisAmount = roundCurrency((averageBuyNav || 0) * units);
    realizedProfitAmount = roundCurrency(units * nav - (realizedCostBasisAmount || 0));
  }

  await connectToDatabase();

  await MutualFundTransaction.create({
    userId,
    schemeCode: input.schemeCode,
    schemeName: input.schemeName.trim(),
    transactionType: input.transactionType,
    units,
    nav,
    amount: roundCurrency(units * nav),
    averageBuyNav,
    realizedCostBasisAmount,
    realizedProfitAmount,
    transactionDate,
  });

  const updatedTransactions = await loadTransactions(userId);
  await ensureSnapshotsUpToDate(userId, updatedTransactions);
}

export async function getMutualFundNavHistory(
  schemeCode: number,
  fallbackSchemeName?: string
): Promise<MutualFundNavHistory | null> {
  const currentMonth = startOfMonth(new Date());
  const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 11, 1);
  const endDate = new Date();
  const result = await fetchNavHistoryForScheme(
    schemeCode,
    formatApiDate(startDate),
    formatApiDate(endDate)
  );

  if (!result?.data?.length) {
    return null;
  }

  const latestPointByMonth = new Map<string, MutualFundNavHistoryPoint>();

  for (const entry of result.data) {
    const parsedDate = entry.date ? parseMfApiDate(entry.date) : null;
    const nav = Number(entry.nav || "");

    if (!parsedDate || !Number.isFinite(nav) || nav <= 0) {
      continue;
    }

    const key = monthKey(parsedDate);

    if (!latestPointByMonth.has(key)) {
      latestPointByMonth.set(key, {
        key,
        label: getMonthYearLabel(parsedDate),
        date: parsedDate.toISOString(),
        nav: roundCurrency(nav),
      });
    }
  }

  const points = Array.from({ length: 12 }, (_, index) => {
    const monthStart = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - (11 - index),
      1
    );

    return latestPointByMonth.get(monthKey(monthStart)) || null;
  }).filter((point): point is MutualFundNavHistoryPoint => Boolean(point));

  if (!points.length) {
    return null;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const changeAmount = roundCurrency(lastPoint.nav - firstPoint.nav);
  const changePct = firstPoint.nav
    ? roundCurrency((changeAmount / firstPoint.nav) * 100)
    : 0;

  return {
    schemeCode,
    schemeName: result.meta?.scheme_name || fallbackSchemeName || `Scheme ${schemeCode}`,
    latestNav: lastPoint.nav,
    changeAmount,
    changePct,
    points,
  };
}

export async function getMutualFundDashboard(
  userId: string
): Promise<MutualFundDashboardData> {
  const transactions = await loadTransactions(userId);

  if (transactions.length) {
    await ensureSnapshotsUpToDate(userId, transactions);
  }

  const monthStarts = getMonthStarts(6);
  const snapshots = await MutualFundMonthlySnapshot.find({
    userId,
    monthKey: {
      $in: monthStarts.map((date) => monthKey(date)),
    },
  })
    .sort({ year: 1, month: 1 })
    .lean();

  const snapshotMap = new Map(
    snapshots.map((snapshot) => [
      snapshot.monthKey,
      {
        totalInvested: roundCurrency(snapshot.totalInvested),
        totalValue: roundCurrency(snapshot.totalValue),
      },
    ])
  );

  const months: MutualFundMonthSummary[] = monthStarts.map((start) => {
    const key = monthKey(start);
    const snapshot = snapshotMap.get(key);

    return {
      key,
      label: getMonthLabel(start),
      totalInvested: snapshot?.totalInvested || 0,
      totalValue: snapshot?.totalValue || 0,
    };
  });

  const liveHoldings = await applyLiveCurrentNav(buildHoldingsFromTransactions(transactions));
  const holdings = mapHoldingsToSummary(liveHoldings);
  const totalPortfolioValue = roundCurrency(
    holdings.reduce((sum, holding) => sum + holding.currentValue, 0)
  );
  const totalInvestedAmount = roundCurrency(
    holdings.reduce((sum, holding) => sum + holding.investedAmount, 0)
  );
  const totalRealizedProfitAmount = roundCurrency(
    transactions.reduce((sum, transaction) => {
      return sum + (transaction.realizedProfitAmount || 0);
    }, 0)
  );
  const totalRealizedCostBasisAmount = roundCurrency(
    transactions.reduce((sum, transaction) => {
      return sum + (transaction.realizedCostBasisAmount || 0);
    }, 0)
  );
  const totalRealizedProfitPct = totalRealizedCostBasisAmount
    ? roundCurrency((totalRealizedProfitAmount / totalRealizedCostBasisAmount) * 100)
    : 0;
  const totalProfitLossAmount = roundCurrency(totalPortfolioValue - totalInvestedAmount);
  const totalProfitLossPct = totalInvestedAmount
    ? roundCurrency((totalProfitLossAmount / totalInvestedAmount) * 100)
    : 0;
  const latestMonth = months[months.length - 1];

  if (latestMonth) {
    latestMonth.totalInvested = totalInvestedAmount;
    latestMonth.totalValue = totalPortfolioValue;
  }

  const previousMonthValue = months.length > 1 ? months[months.length - 2].totalValue : 0;
  const monthOverMonthChangeAmount = roundCurrency(totalPortfolioValue - previousMonthValue);
  const monthOverMonthChangePct =
    previousMonthValue === 0
      ? totalPortfolioValue === 0
        ? 0
        : 100
      : roundCurrency((monthOverMonthChangeAmount / Math.abs(previousMonthValue)) * 100);

  const recentTransactions: MutualFundTransactionSummary[] = [...transactions]
    .sort((left, right) => {
      return (
        new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime()
      );
    })
    .slice(0, 8)
    .map((transaction) => ({
      id: String(transaction._id),
      schemeCode: transaction.schemeCode,
      schemeName: transaction.schemeName,
      transactionType: transaction.transactionType,
      units: roundCurrency(transaction.units),
      nav: roundCurrency(transaction.nav),
      amount: roundCurrency(transaction.amount),
      averageBuyNav:
        transaction.averageBuyNav != null ? roundCurrency(transaction.averageBuyNav) : null,
      realizedProfitAmount:
        transaction.realizedProfitAmount != null
          ? roundCurrency(transaction.realizedProfitAmount)
          : null,
      realizedProfitPct:
        transaction.realizedCostBasisAmount != null &&
        transaction.realizedProfitAmount != null &&
        transaction.realizedCostBasisAmount !== 0
          ? roundCurrency(
              (transaction.realizedProfitAmount / transaction.realizedCostBasisAmount) * 100
            )
          : null,
      date: new Date(transaction.transactionDate).toISOString(),
    }));

  return {
    totalPortfolioValue,
    totalInvestedAmount,
    totalRealizedProfitAmount,
    totalRealizedProfitPct,
    totalProfitLossAmount,
    totalProfitLossPct,
    monthOverMonthChangeAmount,
    monthOverMonthChangePct,
    months,
    distribution: holdings,
    topHoldings: holdings.slice(0, 5),
    holdings,
    recentTransactions,
  };
}
