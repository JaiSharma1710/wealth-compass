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

export type CashReserveDashboardData = {
  totalBalance: number;
  monthOverMonthChangePct: number;
  monthOverMonthChangeAmount: number;
  months: CashReserveMonthSummary[];
  recentEntries: CashReserveEntrySummary[];
};
