import "server-only";

import { Types } from "mongoose";

import { getCashReserveDashboard } from "@/lib/cash-reserves";
import type { SafeUser } from "@/lib/auth";
import type {
  GoalAssetGroup,
  GoalAssetType,
  GoalLinkedAssetOption,
  GoalsOverview,
  GoalsPageData,
  GoalSummary,
} from "@/lib/goals.types";
import { getGoldDashboard } from "@/lib/gold";
import { Goal } from "@/lib/models/goal";
import { connectToDatabase } from "@/lib/mongodb";
import { getMutualFundDashboard } from "@/lib/mutual-funds";

type CreateGoalInput = {
  name: string;
  note: string;
  targetAmount: number;
  targetDate: string;
  assetType: GoalAssetType;
  investmentId: string;
};

type GoalLeanDocument = {
  _id: { toString(): string } | string;
  name: string;
  note?: string | null;
  targetAmount: number;
  targetDate?: Date | null;
  assetType: GoalAssetType;
  investmentId: string;
  investmentLabel: string;
  investmentDetail?: string | null;
  updatedAt?: Date | null;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
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

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildAssetGroups(params: {
  banks: string[];
  cashDashboard: Awaited<ReturnType<typeof getCashReserveDashboard>>;
  goldDashboard: Awaited<ReturnType<typeof getGoldDashboard>>;
  mutualFundDashboard: Awaited<ReturnType<typeof getMutualFundDashboard>>;
}): GoalAssetGroup[] {
  const bankBalances = new Map(
    params.cashDashboard.bankDistribution.map((entry) => [entry.bank, entry.balance])
  );
  const cashOptions: GoalLinkedAssetOption[] = Array.from(
    new Set(params.banks.map((bank) => normalizeLabel(bank)).filter(Boolean))
  ).map((bank) => ({
    assetType: "cash",
    assetTypeLabel: "Cash",
    investmentId: `cash::${bank}`,
    investmentLabel: bank,
    investmentDetail: "Bank account",
    currentValue: roundCurrency(bankBalances.get(bank) || 0),
    isAvailable: true,
  }));

  const goldOptions: GoalLinkedAssetOption[] = params.goldDashboard.holdings.map((holding) => ({
    assetType: "gold",
    assetTypeLabel: "Gold",
    investmentId: holding.id,
    investmentLabel: holding.schemeName,
    investmentDetail: holding.investmentOptionLabel,
    currentValue: roundCurrency(holding.currentValue),
    isAvailable: true,
  }));

  const mutualFundOptions: GoalLinkedAssetOption[] = params.mutualFundDashboard.holdings.map(
    (holding) => ({
      assetType: "mutual_fund",
      assetTypeLabel: "Mutual Fund",
      investmentId: String(holding.schemeCode),
      investmentLabel: holding.schemeName,
      investmentDetail: `${holding.units} units`,
      currentValue: roundCurrency(holding.currentValue),
      isAvailable: true,
    })
  );

  return [
    {
      assetType: "cash",
      label: "Cash",
      description: "Link a goal to a bank balance and track reserve-backed goals automatically.",
      available: cashOptions.length > 0,
      options: cashOptions,
      emptyMessage: "Add banks in Settings to start linking cash-backed goals.",
    },
    {
      assetType: "gold",
      label: "Gold",
      description: "Use a specific gold holding such as SGBs, ETFs, or digital gold.",
      available: goldOptions.length > 0,
      options: goldOptions,
      emptyMessage: "Create a gold holding first, then link it to a goal.",
    },
    {
      assetType: "mutual_fund",
      label: "Mutual Fund",
      description: "Attach a goal to one live mutual fund holding and monitor value growth.",
      available: mutualFundOptions.length > 0,
      options: mutualFundOptions,
      emptyMessage: "Buy a mutual fund before linking it to a goal.",
    },
    {
      assetType: "stock",
      label: "Stocks",
      description: "Reserved for direct stock linking once stock holdings are live in the app.",
      available: false,
      options: [],
      emptyMessage: "Stock holdings are not connected in this version yet.",
    },
  ];
}

function getAssetOptionLookup(assetGroups: GoalAssetGroup[]) {
  return new Map(
    assetGroups.flatMap((group) =>
      group.options.map((option) => [`${option.assetType}::${option.investmentId}`, option] as const)
    )
  );
}

function buildGoalSummary(
  goal: GoalLeanDocument,
  optionLookup: Map<string, GoalLinkedAssetOption>
): GoalSummary {
  const linkedOption = optionLookup.get(`${goal.assetType}::${goal.investmentId}`);
  const currentValue = roundCurrency(linkedOption?.currentValue || 0);
  const fundedAmount = roundCurrency(Math.min(currentValue, goal.targetAmount));
  const remainingAmount = roundCurrency(Math.max(goal.targetAmount - currentValue, 0));
  const progressPct = goal.targetAmount
    ? Math.min(100, roundCurrency((currentValue / goal.targetAmount) * 100))
    : 0;
  const assetTypeLabel = linkedOption?.assetTypeLabel || getAssetTypeLabel(goal.assetType);

  return {
    id: String(goal._id),
    name: goal.name,
    note: goal.note || "",
    targetAmount: roundCurrency(goal.targetAmount),
    targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
    assetType: goal.assetType,
    assetTypeLabel,
    investmentId: goal.investmentId,
    investmentLabel: linkedOption?.investmentLabel || goal.investmentLabel,
    investmentDetail: linkedOption?.investmentDetail || goal.investmentDetail || "",
    currentValue,
    fundedAmount,
    remainingAmount,
    progressPct,
    isCompleted: currentValue >= goal.targetAmount,
    isLinkActive: Boolean(linkedOption),
    updatedAt: goal.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

function buildOverview(goals: GoalSummary[]): GoalsOverview {
  const totalGoals = goals.length;
  const completedGoals = goals.filter((goal) => goal.isCompleted).length;
  const totalTargetAmount = roundCurrency(
    goals.reduce((sum, goal) => sum + goal.targetAmount, 0)
  );
  const totalRemainingAmount = roundCurrency(
    goals.reduce((sum, goal) => sum + goal.remainingAmount, 0)
  );
  const averageProgressPct = totalGoals
    ? roundCurrency(goals.reduce((sum, goal) => sum + goal.progressPct, 0) / totalGoals)
    : 0;

  return {
    totalGoals,
    completedGoals,
    totalTargetAmount,
    averageProgressPct,
    totalRemainingAmount,
  };
}

function getAssetTypeLabel(assetType: GoalAssetType) {
  switch (assetType) {
    case "cash":
      return "Cash";
    case "gold":
      return "Gold";
    case "mutual_fund":
      return "Mutual Fund";
    case "stock":
      return "Stocks";
    default:
      return "Asset";
  }
}

async function getGoalAssetGroupsForUser(user: SafeUser) {
  const [cashDashboard, goldDashboard, mutualFundDashboard] = await Promise.all([
    getCashReserveDashboard(user.id),
    getGoldDashboard(user.id),
    getMutualFundDashboard(user.id),
  ]);

  return buildAssetGroups({
    banks: user.profile.banks,
    cashDashboard,
    goldDashboard,
    mutualFundDashboard,
  });
}

export async function getGoalsPageData(user: SafeUser): Promise<GoalsPageData> {
  await connectToDatabase();

  const [assetGroups, goals] = await Promise.all([
    getGoalAssetGroupsForUser(user),
    Goal.find({ userId: new Types.ObjectId(user.id) }).sort({ createdAt: -1 }).lean<GoalLeanDocument[]>(),
  ]);

  const optionLookup = getAssetOptionLookup(assetGroups);
  const goalSummaries = goals
    .map((goal) => buildGoalSummary(goal, optionLookup))
    .sort((left, right) => {
      if (left.isCompleted !== right.isCompleted) {
        return left.isCompleted ? 1 : -1;
      }

      return right.remainingAmount - left.remainingAmount;
    });

  return {
    overview: buildOverview(goalSummaries),
    goals: goalSummaries,
    assetGroups,
  };
}

export async function createGoal(user: SafeUser, input: CreateGoalInput) {
  const name = normalizeLabel(input.name);
  const note = input.note.trim();
  const targetDate = input.targetDate.trim();

  if (name.length < 2 || name.length > 120) {
    throw new Error("Goal name must be between 2 and 120 characters.");
  }

  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    throw new Error("Target amount must be greater than zero.");
  }

  if (note.length > 300) {
    throw new Error("Note must be 300 characters or fewer.");
  }

  const parsedTargetDate = targetDate ? parseDateOnly(targetDate) : null;

  if (targetDate && !parsedTargetDate) {
    throw new Error("Target date must be a valid date.");
  }

  const assetGroups = await getGoalAssetGroupsForUser(user);
  const selectedGroup = assetGroups.find((group) => group.assetType === input.assetType);

  if (!selectedGroup || !selectedGroup.available) {
    throw new Error("This asset type is not available for goal linking yet.");
  }

  const selectedOption = selectedGroup.options.find(
    (option) => option.investmentId === input.investmentId
  );

  if (!selectedOption) {
    throw new Error("Please choose a valid investment to link with this goal.");
  }

  await connectToDatabase();

  await Goal.create({
    userId: user.id,
    name,
    note,
    targetAmount: roundCurrency(input.targetAmount),
    targetDate: parsedTargetDate,
    assetType: input.assetType,
    investmentId: selectedOption.investmentId,
    investmentLabel: selectedOption.investmentLabel,
    investmentDetail: selectedOption.investmentDetail,
  });
}

export async function deleteGoal(userId: string, goalId: string) {
  if (!Types.ObjectId.isValid(goalId)) {
    throw new Error("Invalid goal ID.");
  }

  await connectToDatabase();

  const deletedGoal = await Goal.findOneAndDelete({
    _id: new Types.ObjectId(goalId),
    userId: new Types.ObjectId(userId),
  });

  if (!deletedGoal) {
    throw new Error("Goal not found.");
  }
}
