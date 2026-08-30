export type DebtLoanType = "standard" | "no_cost_emi";

export type DebtScheduleRow = {
  installmentNumber: number;
  dueDate: string;
  openingBalance: number;
  emiAmount: number;
  principalPaid: number;
  interestPaid: number;
  prepaymentAmount: number;
  totalPayment: number;
  closingBalance: number;
  isPaid: boolean;
};

export type DebtLoanSummary = {
  id: string;
  name: string;
  lender: string;
  loanType: DebtLoanType;
  principalAmount: number;
  annualInterestRate: number;
  durationMonths: number;
  startDate: string;
  emiPaymentDay: number;
  plannedPrepaymentAmount: number;
  note: string;
  emiAmount: number;
  totalPayable: number;
  totalInterest: number;
  totalPrepayment: number;
  paidInstallments: number;
  remainingInstallments: number;
  paidAmount: number;
  remainingAmount: number;
  paidPrincipal: number;
  paidInterest: number;
  remainingPrincipal: number;
  progressPct: number;
  expectedClosureDate: string | null;
  schedule: DebtScheduleRow[];
  createdAt: string;
  updatedAt: string;
};

export type DebtOverview = {
  totalLoans: number;
  activeLoans: number;
  closedLoans: number;
  totalOriginalPrincipal: number;
  totalOutstandingPrincipal: number;
  totalPaidAmount: number;
  totalPaidPrincipal: number;
  totalPaidInterest: number;
  totalRemainingAmount: number;
  totalInterestPayable: number;
  nextEmiDate: string | null;
  nextEmiAmount: number;
};

export type DebtPageData = {
  overview: DebtOverview;
  loans: DebtLoanSummary[];
};
