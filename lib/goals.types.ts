export const GOAL_ASSET_TYPES = ["cash", "gold", "mutual_fund", "stock"] as const;

export type GoalAssetType = (typeof GOAL_ASSET_TYPES)[number];

/** `investmentId` value that links a goal to a whole asset class (all MFs, all gold, ...). */
export const GOAL_WHOLE_CLASS_ID = "*";

export type GoalStatus = "completed" | "on_track" | "behind" | "overdue" | "no_date";

/** A source stored on a goal. */
export type GoalLinkInput = {
  assetType: GoalAssetType;
  investmentId: string;
};

export type GoalLinkedAssetOption = {
  assetType: GoalAssetType;
  assetTypeLabel: string;
  investmentId: string;
  investmentLabel: string;
  investmentDetail: string;
  currentValue: number;
  isAvailable: boolean;
  isWholeClass: boolean;
};

export type GoalAssetGroup = {
  assetType: GoalAssetType;
  label: string;
  description: string;
  available: boolean;
  options: GoalLinkedAssetOption[];
  emptyMessage: string;
};

export type GoalLinkSummary = {
  assetType: GoalAssetType;
  assetTypeLabel: string;
  investmentId: string;
  label: string;
  detail: string;
  currentValue: number;
  isWholeClass: boolean;
  /** False when the linked holding no longer exists. */
  isActive: boolean;
  /** True when counted in the goal total (false when covered by a whole-class link). */
  isCounted: boolean;
};

export type GoalSummary = {
  id: string;
  name: string;
  note: string;
  targetAmount: number;
  targetDate: string | null;
  links: GoalLinkSummary[];
  currentValue: number;
  fundedAmount: number;
  remainingAmount: number;
  progressPct: number;
  isCompleted: boolean;
  status: GoalStatus;
  /** Whole months until target date (min 1), null without a future date. */
  monthsLeft: number | null;
  /** Remaining / monthsLeft, assuming no growth. Null without a future date or when completed. */
  requiredMonthly: number | null;
  /** Share of the plan period elapsed (0-100) that progress is compared against. */
  expectedPct: number | null;
  createdAt: string;
  updatedAt: string;
};

export type GoalsOverview = {
  totalGoals: number;
  completedGoals: number;
  totalTargetAmount: number;
  totalSavedAmount: number;
  averageProgressPct: number;
  overallProgressPct: number;
  totalRemainingAmount: number;
  totalRequiredMonthly: number;
  behindGoals: number;
};

export type GoalsPageData = {
  overview: GoalsOverview;
  goals: GoalSummary[];
  assetGroups: GoalAssetGroup[];
};

export type SaveGoalInput = {
  name: string;
  note?: string;
  targetAmount: number;
  targetDate?: string;
  links: GoalLinkInput[];
};
