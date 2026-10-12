export type CashReserveEntryType = "credit" | "debit";

export type CashReserveMonthSummary = {
  key: string;
  label: string;
  /** e.g. "Oct 26" */
  longLabel?: string;
  credits: number;
  debits: number;
  net: number;
  closingBalance: number;
};

export type CashReserveEntrySummary = {
  id: string;
  date: string;
  amount: number;
  entryType: CashReserveEntryType;
  bank: string;
  note: string;
  /** Local calendar day, yyyy-mm-dd (safe for editing / filtering). */
  dateKey: string;
};

export type CashReserveBankDistribution = {
  bank: string;
  balance: number;
  percentage: number;
  lastMovementDate?: string | null;
  lastMovementAmount?: number | null;
  lastMovementType?: CashReserveEntryType | null;
};

export type CashReserveRecentActivityFilters = {
  month: number | null;
  year: number | null;
  date: string | null;
  entryType: CashReserveEntryType | "all";
};

export type CashReserveRecentActivityPage = {
  entries: CashReserveEntrySummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  filters: CashReserveRecentActivityFilters;
  availableYears: number[];
};

export type CashReserveDashboardData = {
  totalBalance: number;
  monthOverMonthChangePct: number;
  monthOverMonthChangeAmount: number;
  bankDistribution: CashReserveBankDistribution[];
  months: CashReserveMonthSummary[];
  recentActivity: CashReserveRecentActivityPage;
  /** Last 12 months, oldest first (month-end closing balances). */
  history?: CashReserveMonthSummary[];
  /** Every entry (newest first, capped) for client-side filtering. */
  allEntries?: CashReserveEntrySummary[];
  lastActivityDate?: string | null;
};
