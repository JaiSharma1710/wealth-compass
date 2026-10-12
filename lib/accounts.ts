import "server-only";

import { Types } from "mongoose";

import {
  ACCOUNT_CATEGORIES,
  ASSET_ACCOUNT_CATEGORIES,
  LIABILITY_ACCOUNT_CATEGORIES,
  type AccountCategory,
  type AccountKind,
  type AccountsDashboardData,
  type AccountSummary,
  type SaveAccountInput,
} from "@/lib/accounts.types";
import { getTodayDateKey } from "@/lib/daily-values";
import { NetWorthAccount } from "@/lib/models/net-worth-account";
import { connectToDatabase } from "@/lib/mongodb";

const MAX_HISTORY_POINTS = 120;

type AccountLean = {
  _id: Types.ObjectId | string;
  kind: AccountKind;
  category: AccountCategory;
  name: string;
  institution?: string;
  currentValue: number;
  baseAmount?: number | null;
  interestRate?: number | null;
  monthlyPayment?: number | null;
  maturityDate?: Date | null;
  note?: string;
  valueUpdatedAt: Date;
  history?: Array<{ date: string; value: number }>;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getCategoryLabel(category: AccountCategory) {
  return ACCOUNT_CATEGORIES.find((entry) => entry.value === category)?.label || category;
}

function normalizeAccount(account: AccountLean): AccountSummary {
  return {
    id: String(account._id),
    kind: account.kind,
    category: account.category,
    categoryLabel: getCategoryLabel(account.category),
    name: account.name,
    institution: account.institution || "",
    currentValue: roundCurrency(account.currentValue),
    baseAmount: account.baseAmount ?? null,
    interestRate: account.interestRate ?? null,
    monthlyPayment: account.monthlyPayment ?? null,
    maturityDate: account.maturityDate?.toISOString() || null,
    note: account.note || "",
    valueUpdatedAt: account.valueUpdatedAt.toISOString(),
    history: account.history || [],
  };
}

function optionalNumber(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be zero or more.`);
  }

  return roundCurrency(parsed);
}

function validateInput(input: SaveAccountInput) {
  const allowed =
    input.kind === "asset" ? ASSET_ACCOUNT_CATEGORIES : LIABILITY_ACCOUNT_CATEGORIES;

  if (!allowed.some((entry) => entry.value === input.category)) {
    throw new Error("Choose a valid category.");
  }

  const name = String(input.name || "").trim();

  if (name.length < 2) {
    throw new Error("Name must be at least 2 characters.");
  }

  const currentValue = Number(input.currentValue);

  if (!Number.isFinite(currentValue) || currentValue < 0) {
    throw new Error(
      input.kind === "asset" ? "Current value must be zero or more." : "Outstanding must be zero or more."
    );
  }

  const interestRate = optionalNumber(input.interestRate, "Interest rate");

  if (interestRate != null && interestRate > 100) {
    throw new Error("Interest rate must be 100 or less.");
  }

  const maturityDate = input.maturityDate ? new Date(input.maturityDate) : null;

  if (maturityDate && Number.isNaN(maturityDate.getTime())) {
    throw new Error("Maturity date is invalid.");
  }

  return {
    kind: input.kind,
    category: input.category,
    name,
    institution: String(input.institution || "").trim(),
    currentValue: roundCurrency(currentValue),
    baseAmount: optionalNumber(input.baseAmount, "Amount"),
    interestRate,
    monthlyPayment: optionalNumber(input.monthlyPayment, "Monthly payment"),
    maturityDate,
    note: String(input.note || "").trim(),
  };
}

function appendHistory(history: Array<{ date: string; value: number }>, value: number) {
  const date = getTodayDateKey();
  const next = history.filter((point) => point.date !== date);
  next.push({ date, value });
  return next.slice(-MAX_HISTORY_POINTS);
}

export async function getAccountsDashboard(userId: string): Promise<AccountsDashboardData> {
  await connectToDatabase();

  const accounts = (
    await NetWorthAccount.find({ userId: new Types.ObjectId(userId) })
      .sort({ currentValue: -1 })
      .lean<AccountLean[]>()
  ).map(normalizeAccount);
  const assets = accounts.filter((account) => account.kind === "asset");
  const liabilities = accounts.filter((account) => account.kind === "liability");
  const totalAssets = roundCurrency(assets.reduce((sum, account) => sum + account.currentValue, 0));
  const totalLiabilities = roundCurrency(
    liabilities.reduce((sum, account) => sum + account.currentValue, 0)
  );

  return {
    assets,
    liabilities,
    totalAssets,
    // Accounts without a principal are treated as invested at current value (no gain/loss).
    totalAssetsInvested: roundCurrency(
      assets.reduce((sum, account) => sum + (account.baseAmount ?? account.currentValue), 0)
    ),
    totalLiabilities,
    totalMonthlyPayments: roundCurrency(
      liabilities.reduce((sum, account) => sum + (account.monthlyPayment || 0), 0)
    ),
    netValue: roundCurrency(totalAssets - totalLiabilities),
  };
}

export async function createAccount(userId: string, input: SaveAccountInput) {
  const data = validateInput(input);

  await connectToDatabase();
  await NetWorthAccount.create({
    userId: new Types.ObjectId(userId),
    ...data,
    valueUpdatedAt: new Date(),
    history: appendHistory([], data.currentValue),
  });
}

export async function updateAccount(userId: string, accountId: string, input: SaveAccountInput) {
  if (!Types.ObjectId.isValid(accountId)) {
    throw new Error("Account not found.");
  }

  const data = validateInput(input);

  await connectToDatabase();

  const existing = await NetWorthAccount.findOne({
    _id: new Types.ObjectId(accountId),
    userId: new Types.ObjectId(userId),
  }).lean<AccountLean | null>();

  if (!existing) {
    throw new Error("Account not found.");
  }

  const valueChanged = existing.currentValue !== data.currentValue;

  await NetWorthAccount.updateOne(
    { _id: existing._id },
    {
      $set: {
        ...data,
        ...(valueChanged
          ? {
              valueUpdatedAt: new Date(),
              history: appendHistory(existing.history || [], data.currentValue),
            }
          : {}),
      },
    }
  );
}

export async function deleteAccount(userId: string, accountId: string) {
  if (!Types.ObjectId.isValid(accountId)) {
    throw new Error("Account not found.");
  }

  await connectToDatabase();

  const result = await NetWorthAccount.deleteOne({
    _id: new Types.ObjectId(accountId),
    userId: new Types.ObjectId(userId),
  });

  if (!result.deletedCount) {
    throw new Error("Account not found.");
  }
}
