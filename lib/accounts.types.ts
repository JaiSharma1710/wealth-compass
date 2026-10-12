export const ACCOUNT_KINDS = ["asset", "liability"] as const;

export const ASSET_ACCOUNT_CATEGORIES = [
  { value: "fixed_deposit", label: "Fixed Deposit" },
  { value: "ppf", label: "PPF" },
  { value: "epf", label: "EPF / PF" },
  { value: "nps", label: "NPS" },
  { value: "bonds", label: "Bonds" },
  { value: "real_estate", label: "Real Estate" },
  { value: "crypto", label: "Crypto" },
  { value: "other_asset", label: "Other Asset" },
] as const;

export const LIABILITY_ACCOUNT_CATEGORIES = [
  { value: "home_loan", label: "Home Loan" },
  { value: "car_loan", label: "Car Loan" },
  { value: "personal_loan", label: "Personal Loan" },
  { value: "education_loan", label: "Education Loan" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other_liability", label: "Other Liability" },
] as const;

export const ACCOUNT_CATEGORIES = [...ASSET_ACCOUNT_CATEGORIES, ...LIABILITY_ACCOUNT_CATEGORIES];

export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number]["value"];

export type AccountValuePoint = {
  date: string;
  value: number;
};

export type AccountSummary = {
  id: string;
  kind: AccountKind;
  category: AccountCategory;
  categoryLabel: string;
  name: string;
  institution: string;
  /** Asset: current value. Liability: outstanding balance. */
  currentValue: number;
  /** Asset: principal contributed. Liability: original loan amount. */
  baseAmount: number | null;
  interestRate: number | null;
  monthlyPayment: number | null;
  maturityDate: string | null;
  note: string;
  valueUpdatedAt: string;
  history: AccountValuePoint[];
};

export type AccountsDashboardData = {
  assets: AccountSummary[];
  liabilities: AccountSummary[];
  totalAssets: number;
  totalAssetsInvested: number;
  totalLiabilities: number;
  totalMonthlyPayments: number;
  netValue: number;
};

export type SaveAccountInput = {
  kind: AccountKind;
  category: AccountCategory;
  name: string;
  institution?: string;
  currentValue: number;
  baseAmount?: number | null;
  interestRate?: number | null;
  monthlyPayment?: number | null;
  maturityDate?: string | null;
  note?: string;
};
