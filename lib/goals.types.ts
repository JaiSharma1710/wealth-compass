export const GOAL_ASSET_TYPES = ["cash", "gold", "mutual_fund", "stock"] as const;

export type GoalAssetType = (typeof GOAL_ASSET_TYPES)[number];

export type GoalLinkedAssetOption = {
  assetType: GoalAssetType;
  assetTypeLabel: string;
  investmentId: string;
  investmentLabel: string;
  investmentDetail: string;
  currentValue: number;
  isAvailable: boolean;
};

export type GoalAssetGroup = {
  assetType: GoalAssetType;
  label: string;
  description: string;
  available: boolean;
  options: GoalLinkedAssetOption[];
  emptyMessage: string;
};

export type GoalSummary = {
  id: string;
  name: string;
  note: string;
  targetAmount: number;
  targetDate: string | null;
  assetType: GoalAssetType;
  assetTypeLabel: string;
  investmentId: string;
  investmentLabel: string;
  investmentDetail: string;
  currentValue: number;
  fundedAmount: number;
  remainingAmount: number;
  progressPct: number;
  isCompleted: boolean;
  isLinkActive: boolean;
  updatedAt: string;
};

export type GoalsOverview = {
  totalGoals: number;
  completedGoals: number;
  totalTargetAmount: number;
  averageProgressPct: number;
  totalRemainingAmount: number;
};

export type GoalsPageData = {
  overview: GoalsOverview;
  goals: GoalSummary[];
  assetGroups: GoalAssetGroup[];
};
