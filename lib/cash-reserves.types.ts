export type CashReserveEntryType = "credit" | "debit";

export type CashReserveMonthSummary = {
  key: string;
  label: string;
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
  months: CashReserveMonthSummary[];
  recentActivity: CashReserveRecentActivityPage;
};
