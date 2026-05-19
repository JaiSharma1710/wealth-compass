import "server-only";

import { GOLD_INVESTMENT_OPTIONS } from "@/lib/gold.types";
import type {
  GoldActivitySummary,
  GoldDashboardData,
  GoldHoldingSummary,
  GoldInvestmentOption,
  GoldMonthSummary,
  GoldOptionDistribution,
  GoldRecentActivityPage,
  GoldTransactionType,
} from "@/lib/gold.types";
import { connectToDatabase } from "@/lib/mongodb";
import { GoldTransaction } from "@/lib/models/gold-transaction";

const RECENT_ACTIVITY_PAGE_SIZE = 10;
const EPSILON = 0.000001;

type GoldTransactionRecord = {
  _id: { toString(): string } | string;
  investmentOption: GoldInvestmentOption;
  schemeName: string;
  transactionType: GoldTransactionType;
  investedAmount?: number | null;
  currentValue?: number | null;
  sellAmount?: number | null;
  realizedCostBasisAmount?: number | null;
  realizedProfitAmount?: number | null;
  transactionDate: Date;
  createdAt?: Date;
};

type HoldingAccumulator = {
  id: string;
  investmentOption: GoldInvestmentOption;
  investmentOptionLabel: string;
  schemeName: string;
  investedAmount: number;
  currentValue: number;
};

type RealizedTransactionResult = {
  realizedCostBasisAmount: number;
  realizedProfitAmount: number;
};

type LedgerResult = {
  holdings: GoldHoldingSummary[];
  realizedByTransactionId: Map<string, RealizedTransactionResult>;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
  }).format(date);
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

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
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

function getGoldOptionLabel(option: GoldInvestmentOption) {
  return GOLD_INVESTMENT_OPTIONS.find((entry) => entry.value === option)?.label || option;
}

function isGoldInvestmentOption(value: string): value is GoldInvestmentOption {
  return GOLD_INVESTMENT_OPTIONS.some((option) => option.value === value);
}

function normalizeSchemeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function createHoldingId(option: GoldInvestmentOption, schemeName: string) {
  return `${option}::${normalizeSchemeName(schemeName).toLowerCase()}`;
}

function sortTransactions(transactions: GoldTransactionRecord[]) {
  return [...transactions].sort((left, right) => {
    const byDate =
      new Date(left.transactionDate).getTime() - new Date(right.transactionDate).getTime();

    if (byDate !== 0) {
      return byDate;
    }

    return (
      new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime()
    );
  });
}

function normalizeHoldings(holdings: Map<string, HoldingAccumulator>): GoldHoldingSummary[] {
  return [...holdings.values()]
    .filter((holding) => holding.currentValue > EPSILON)
    .map((holding) => {
      const investedAmount = roundCurrency(Math.max(holding.investedAmount, 0));
      const currentValue = roundCurrency(Math.max(holding.currentValue, 0));
      const profitLossAmount = roundCurrency(currentValue - investedAmount);
      const profitLossPct = investedAmount
        ? roundCurrency((profitLossAmount / investedAmount) * 100)
        : 0;

      return {
        ...holding,
        investedAmount,
        currentValue,
        profitLossAmount,
        profitLossPct,
      };
    })
    .sort((left, right) => right.currentValue - left.currentValue);
}

function buildLedgerFromTransactions(
  transactions: GoldTransactionRecord[],
  options?: { cutoffDate?: Date; strict?: boolean }
): LedgerResult {
  const holdings = new Map<string, HoldingAccumulator>();
  const realizedByTransactionId = new Map<string, RealizedTransactionResult>();
  const sortedTransactions = sortTransactions(transactions);

  for (const transaction of sortedTransactions) {
    if (options?.cutoffDate && transaction.transactionDate > options.cutoffDate) {
      break;
    }

    const schemeName = normalizeSchemeName(transaction.schemeName);
    const holdingId = createHoldingId(transaction.investmentOption, schemeName);
    const current = holdings.get(holdingId) || {
      id: holdingId,
      investmentOption: transaction.investmentOption,
      investmentOptionLabel: getGoldOptionLabel(transaction.investmentOption),
      schemeName,
      investedAmount: 0,
      currentValue: 0,
    };

    if (transaction.transactionType === "buy") {
      current.investedAmount += transaction.investedAmount || 0;
      current.currentValue += transaction.currentValue || 0;
      holdings.set(holdingId, current);
      continue;
    }

    if (!holdings.has(holdingId)) {
      if (options?.strict) {
        throw new Error("This change would leave a gold sell or valuation without a holding.");
      }

      continue;
    }

    if (transaction.transactionType === "valuation") {
      const nextCurrentValue = transaction.currentValue || 0;

      if (nextCurrentValue <= 0 && options?.strict) {
        throw new Error("Current value must be greater than zero.");
      }

      current.currentValue = nextCurrentValue;
    } else {
      const sellAmount = transaction.sellAmount || 0;

      if (sellAmount <= 0 && options?.strict) {
        throw new Error("Sell amount must be greater than zero.");
      }

      if (sellAmount - current.currentValue > EPSILON) {
        if (options?.strict) {
          throw new Error("Sell amount cannot exceed the holding current value.");
        }

        continue;
      }

      const realizedCostBasisAmount =
        current.currentValue > 0
          ? current.investedAmount * (sellAmount / current.currentValue)
          : 0;
      const realizedProfitAmount = sellAmount - realizedCostBasisAmount;

      realizedByTransactionId.set(String(transaction._id), {
        realizedCostBasisAmount: roundCurrency(realizedCostBasisAmount),
        realizedProfitAmount: roundCurrency(realizedProfitAmount),
      });

      current.currentValue -= sellAmount;
      current.investedAmount -= realizedCostBasisAmount;
    }

    if (current.currentValue <= EPSILON) {
      holdings.delete(holdingId);
    } else {
      current.currentValue = Math.max(current.currentValue, 0);
      current.investedAmount = Math.max(current.investedAmount, 0);
      holdings.set(holdingId, current);
    }
  }

  return {
    holdings: normalizeHoldings(holdings),
    realizedByTransactionId,
  };
}

async function loadTransactions(userId: string) {
  await connectToDatabase();

  return (await GoldTransaction.find({ userId })
    .sort({ transactionDate: 1, createdAt: 1 })
    .lean()) as GoldTransactionRecord[];
}

function getHoldingFromInput(
  holdings: GoldHoldingSummary[],
  input: { investmentOption: GoldInvestmentOption; schemeName: string }
) {
  const holdingId = createHoldingId(input.investmentOption, input.schemeName);

  return holdings.find((holding) => holding.id === holdingId) || null;
}

function buildOptionDistribution(holdings: GoldHoldingSummary[]): GoldOptionDistribution[] {
  const totalCurrentValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const distribution = new Map<GoldInvestmentOption, number>();

  for (const holding of holdings) {
    distribution.set(
      holding.investmentOption,
      (distribution.get(holding.investmentOption) || 0) + holding.currentValue
    );
  }

  return [...distribution.entries()]
    .map(([investmentOption, currentValue]) => ({
      investmentOption,
      investmentOptionLabel: getGoldOptionLabel(investmentOption),
      currentValue: roundCurrency(currentValue),
      percentage: totalCurrentValue
        ? roundCurrency((currentValue / totalCurrentValue) * 100)
        : 0,
    }))
    .sort((left, right) => right.currentValue - left.currentValue);
}

export async function getGoldRecentActivity(
  userId: string,
  options?: { page?: number; pageSize?: number }
): Promise<GoldRecentActivityPage> {
  await connectToDatabase();

  const pageSize = Math.min(
    Math.max(options?.pageSize || RECENT_ACTIVITY_PAGE_SIZE, 1),
    RECENT_ACTIVITY_PAGE_SIZE
  );
  const requestedPage = Math.max(options?.page || 1, 1);
  const totalCount = await GoldTransaction.countDocuments({ userId });
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;
  const page = Math.min(requestedPage, totalPages);
  const entries = (await GoldTransaction.find({ userId })
    .sort({ transactionDate: -1, createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean()) as GoldTransactionRecord[];
  const allTransactions = await loadTransactions(userId);
  const ledger = buildLedgerFromTransactions(allTransactions);

  return {
    entries: entries.map((entry) => {
      const realized = ledger.realizedByTransactionId.get(String(entry._id));

      return {
        id: String(entry._id),
        date: new Date(entry.transactionDate).toISOString(),
        transactionType: entry.transactionType,
        investmentOption: entry.investmentOption,
        investmentOptionLabel: getGoldOptionLabel(entry.investmentOption),
        schemeName: entry.schemeName,
        investedAmount:
          entry.transactionType === "buy" ? roundCurrency(entry.investedAmount || 0) : null,
        currentValue:
          entry.transactionType === "buy" || entry.transactionType === "valuation"
            ? roundCurrency(entry.currentValue || 0)
            : null,
        sellAmount:
          entry.transactionType === "sell" ? roundCurrency(entry.sellAmount || 0) : null,
        realizedProfitAmount:
          entry.transactionType === "sell"
            ? realized?.realizedProfitAmount ??
              (typeof entry.realizedProfitAmount === "number"
                ? roundCurrency(entry.realizedProfitAmount)
                : null)
            : null,
      } satisfies GoldActivitySummary;
    }),
    page,
    pageSize,
    totalCount,
    totalPages,
  };
}

export async function getGoldDashboard(userId: string): Promise<GoldDashboardData> {
  const transactions = await loadTransactions(userId);
  const ledger = buildLedgerFromTransactions(transactions);
  const holdings = ledger.holdings;
  const totalCurrentValue = roundCurrency(
    holdings.reduce((sum, holding) => sum + holding.currentValue, 0)
  );
  const totalInvestedAmount = roundCurrency(
    holdings.reduce((sum, holding) => sum + holding.investedAmount, 0)
  );
  const totalProfitLossAmount = roundCurrency(totalCurrentValue - totalInvestedAmount);
  const totalProfitLossPct = totalInvestedAmount
    ? roundCurrency((totalProfitLossAmount / totalInvestedAmount) * 100)
    : 0;
  const monthStarts = getMonthStarts(6);
  const months: GoldMonthSummary[] = monthStarts.map((start) => {
    const monthLedger = buildLedgerFromTransactions(transactions, {
      cutoffDate: endOfMonth(start),
    });
    const monthHoldings = monthLedger.holdings;

    return {
      key: monthKey(start),
      label: getMonthLabel(start),
      totalInvested: roundCurrency(
        monthHoldings.reduce((sum, holding) => sum + holding.investedAmount, 0)
      ),
      totalValue: roundCurrency(
        monthHoldings.reduce((sum, holding) => sum + holding.currentValue, 0)
      ),
    };
  });
  const latestMonth = months[months.length - 1];

  if (latestMonth) {
    latestMonth.totalInvested = totalInvestedAmount;
    latestMonth.totalValue = totalCurrentValue;
  }

  const previousMonthValue = months.length > 1 ? months[months.length - 2].totalValue : 0;
  const monthOverMonthChangeAmount = roundCurrency(totalCurrentValue - previousMonthValue);
  const monthOverMonthChangePct =
    previousMonthValue === 0
      ? totalCurrentValue === 0
        ? 0
        : 100
      : roundCurrency((monthOverMonthChangeAmount / Math.abs(previousMonthValue)) * 100);
  const recentActivity = await getGoldRecentActivity(userId, {
    page: 1,
    pageSize: RECENT_ACTIVITY_PAGE_SIZE,
  });

  return {
    totalCurrentValue,
    totalInvestedAmount,
    totalProfitLossAmount,
    totalProfitLossPct,
    monthOverMonthChangeAmount,
    monthOverMonthChangePct,
    months,
    holdings,
    optionDistribution: buildOptionDistribution(holdings),
    recentActivity,
  };
}

export async function saveGoldTransaction(
  userId: string,
  input: {
    transactionType: GoldTransactionType;
    investmentOption: string;
    schemeName: string;
    date: string;
    investedAmount?: number;
    currentValue?: number;
    sellAmount?: number;
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

  if (!isGoldInvestmentOption(input.investmentOption)) {
    throw new Error("Please choose a valid gold investment option.");
  }

  const schemeName = normalizeSchemeName(input.schemeName);

  if (!schemeName) {
    throw new Error("Fund or scheme name is required.");
  }

  if (schemeName.length > 220) {
    throw new Error("Fund or scheme name must be 220 characters or fewer.");
  }

  const transactions = await loadTransactions(userId);
  const holdingsOnDate = buildLedgerFromTransactions(transactions, {
    cutoffDate: new Date(
      transactionDate.getFullYear(),
      transactionDate.getMonth(),
      transactionDate.getDate(),
      23,
      59,
      59,
      999
    ),
    strict: true,
  }).holdings;
  const holding = getHoldingFromInput(holdingsOnDate, {
    investmentOption: input.investmentOption,
    schemeName,
  });
  const baseRecord: Omit<GoldTransactionRecord, "_id"> = {
    investmentOption: input.investmentOption,
    schemeName,
    transactionType: input.transactionType,
    transactionDate,
    createdAt: new Date(),
  };
  let record: GoldTransactionRecord;

  if (input.transactionType === "buy") {
    const investedAmount = roundCurrency(Number(input.investedAmount));
    const currentValue = roundCurrency(Number(input.currentValue));

    if (!Number.isFinite(investedAmount) || investedAmount <= 0) {
      throw new Error("Invested amount must be greater than zero.");
    }

    if (!Number.isFinite(currentValue) || currentValue <= 0) {
      throw new Error("Current value must be greater than zero.");
    }

    record = {
      ...baseRecord,
      _id: "pending",
      investedAmount,
      currentValue,
      sellAmount: null,
    };
  } else if (input.transactionType === "sell") {
    const sellAmount = roundCurrency(Number(input.sellAmount));

    if (!holding) {
      throw new Error("Please choose an active gold holding to sell.");
    }

    if (!Number.isFinite(sellAmount) || sellAmount <= 0) {
      throw new Error("Sell amount must be greater than zero.");
    }

    if (sellAmount - holding.currentValue > EPSILON) {
      throw new Error("Sell amount cannot exceed the holding current value.");
    }

    const realizedCostBasisAmount =
      holding.currentValue > 0
        ? roundCurrency(holding.investedAmount * (sellAmount / holding.currentValue))
        : 0;

    record = {
      ...baseRecord,
      _id: "pending",
      investedAmount: null,
      currentValue: null,
      sellAmount,
      realizedCostBasisAmount,
      realizedProfitAmount: roundCurrency(sellAmount - realizedCostBasisAmount),
    };
  } else {
    const currentValue = roundCurrency(Number(input.currentValue));

    if (!holding) {
      throw new Error("Please choose an active gold holding to update.");
    }

    if (!Number.isFinite(currentValue) || currentValue <= 0) {
      throw new Error("Current value must be greater than zero.");
    }

    record = {
      ...baseRecord,
      _id: "pending",
      investedAmount: null,
      currentValue,
      sellAmount: null,
    };
  }

  buildLedgerFromTransactions([...transactions, record], { strict: true });

  await connectToDatabase();
  await GoldTransaction.create({
    userId,
    investmentOption: record.investmentOption,
    schemeName: record.schemeName,
    transactionType: record.transactionType,
    investedAmount: record.investedAmount ?? null,
    currentValue: record.currentValue ?? null,
    sellAmount: record.sellAmount ?? null,
    realizedCostBasisAmount: record.realizedCostBasisAmount ?? null,
    realizedProfitAmount: record.realizedProfitAmount ?? null,
    transactionDate,
  });
}

export async function deleteGoldTransaction(userId: string, transactionId: string) {
  await connectToDatabase();

  const transaction = await GoldTransaction.findOne({
    _id: transactionId,
    userId,
  }).lean();

  if (!transaction) {
    throw new Error("Gold transaction was not found.");
  }

  const transactions = await loadTransactions(userId);
  const remainingTransactions = transactions.filter(
    (entry) => String(entry._id) !== String(transaction._id)
  );

  buildLedgerFromTransactions(remainingTransactions, { strict: true });
  await GoldTransaction.deleteOne({ _id: transaction._id, userId });
}
