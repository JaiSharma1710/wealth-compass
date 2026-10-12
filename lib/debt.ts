import "server-only";

import { Types } from "mongoose";

import { calculateDebtSchedule } from "@/lib/debt-calculations";
import type { DebtLoanSummary, DebtLoanType, DebtOverview, DebtPageData } from "@/lib/debt.types";
import { DebtLoan } from "@/lib/models/debt-loan";
import { connectToDatabase } from "@/lib/mongodb";

type DebtLoanLeanDocument = {
  _id: { toString(): string } | string;
  name: string;
  lender: string;
  loanType: DebtLoanType;
  principalAmount: number;
  annualInterestRate: number;
  durationMonths: number;
  startDate: Date;
  emiPaymentDay: number;
  plannedPrepaymentAmount?: number | null;
  note?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type CreateDebtLoanInput = {
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
};

const BALANCE_EPSILON = 0.01;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
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

function buildLoanSummary(loan: DebtLoanLeanDocument): DebtLoanSummary {
  const schedule = calculateDebtSchedule({
    principalAmount: loan.principalAmount,
    annualInterestRate: loan.loanType === "no_cost_emi" ? 0 : loan.annualInterestRate,
    durationMonths: loan.durationMonths,
    startDate: loan.startDate,
    emiPaymentDay: loan.emiPaymentDay,
    plannedPrepaymentAmount: loan.plannedPrepaymentAmount || 0,
  });
  const paidRows = schedule.filter((row) => row.isPaid);
  const remainingRows = schedule.filter((row) => !row.isPaid);
  const paidAmount = roundCurrency(paidRows.reduce((sum, row) => sum + row.totalPayment, 0));
  const paidPrincipal = roundCurrency(paidRows.reduce((sum, row) => sum + row.principalPaid, 0));
  const paidInterest = roundCurrency(paidRows.reduce((sum, row) => sum + row.interestPaid, 0));
  const totalPayable = roundCurrency(schedule.reduce((sum, row) => sum + row.totalPayment, 0));
  const totalInterest = roundCurrency(schedule.reduce((sum, row) => sum + row.interestPaid, 0));
  const totalPrepayment = roundCurrency(schedule.reduce((sum, row) => sum + row.prepaymentAmount, 0));
  const remainingPrincipal = roundCurrency(Math.max(loan.principalAmount - paidPrincipal, 0));
  const remainingAmount = roundCurrency(remainingRows.reduce((sum, row) => sum + row.totalPayment, 0));
  const finalRow = schedule.at(-1);

  return {
    id: String(loan._id),
    name: loan.name,
    lender: loan.lender,
    loanType: loan.loanType,
    principalAmount: roundCurrency(loan.principalAmount),
    annualInterestRate: loan.loanType === "no_cost_emi" ? 0 : roundCurrency(loan.annualInterestRate),
    durationMonths: loan.durationMonths,
    startDate: loan.startDate.toISOString(),
    emiPaymentDay: loan.emiPaymentDay,
    plannedPrepaymentAmount: roundCurrency(loan.plannedPrepaymentAmount || 0),
    note: loan.note || "",
    emiAmount: schedule[0]?.emiAmount || 0,
    totalPayable,
    totalInterest,
    totalPrepayment,
    paidInstallments: paidRows.length,
    remainingInstallments: remainingRows.length,
    paidAmount,
    remainingAmount,
    paidPrincipal,
    paidInterest,
    remainingPrincipal,
    progressPct: loan.principalAmount ? roundCurrency((paidPrincipal / loan.principalAmount) * 100) : 0,
    expectedClosureDate: finalRow?.dueDate || null,
    schedule,
    createdAt: loan.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: loan.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

function buildOverview(loans: DebtLoanSummary[]): DebtOverview {
  const totalLoans = loans.length;
  const activeLoans = loans.filter((loan) => loan.remainingPrincipal > BALANCE_EPSILON).length;
  const nextUnpaidRows = loans
    .flatMap((loan) => loan.schedule.filter((row) => !row.isPaid).slice(0, 1))
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime());
  const nextEmiDate = nextUnpaidRows[0]?.dueDate || null;

  return {
    totalLoans,
    activeLoans,
    closedLoans: totalLoans - activeLoans,
    totalOriginalPrincipal: roundCurrency(loans.reduce((sum, loan) => sum + loan.principalAmount, 0)),
    totalOutstandingPrincipal: roundCurrency(
      loans.reduce((sum, loan) => sum + loan.remainingPrincipal, 0)
    ),
    totalPaidAmount: roundCurrency(loans.reduce((sum, loan) => sum + loan.paidAmount, 0)),
    totalPaidPrincipal: roundCurrency(loans.reduce((sum, loan) => sum + loan.paidPrincipal, 0)),
    totalPaidInterest: roundCurrency(loans.reduce((sum, loan) => sum + loan.paidInterest, 0)),
    totalRemainingAmount: roundCurrency(loans.reduce((sum, loan) => sum + loan.remainingAmount, 0)),
    totalInterestPayable: roundCurrency(loans.reduce((sum, loan) => sum + loan.totalInterest, 0)),
    nextEmiDate,
    nextEmiAmount: roundCurrency(
      nextEmiDate
        ? nextUnpaidRows
            .filter((row) => row.dueDate === nextEmiDate)
            .reduce((sum, row) => sum + row.totalPayment, 0)
        : 0
    ),
  };
}

export function getDebtLoanTypeLabel(loanType: DebtLoanType) {
  return loanType === "no_cost_emi" ? "No-cost EMI" : "Standard loan";
}

export async function getDebtPageData(userId: string): Promise<DebtPageData> {
  await connectToDatabase();

  const loans = await DebtLoan.find({ userId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean<DebtLoanLeanDocument[]>();
  const summaries = loans.map(buildLoanSummary).sort((left, right) => {
    if (left.remainingPrincipal > BALANCE_EPSILON && right.remainingPrincipal <= BALANCE_EPSILON) {
      return -1;
    }

    if (left.remainingPrincipal <= BALANCE_EPSILON && right.remainingPrincipal > BALANCE_EPSILON) {
      return 1;
    }

    return new Date(left.startDate).getTime() - new Date(right.startDate).getTime();
  });

  return {
    overview: buildOverview(summaries),
    loans: summaries,
  };
}

export async function createDebtLoan(userId: string, input: CreateDebtLoanInput) {
  const name = normalizeLabel(input.name);
  const lender = normalizeLabel(input.lender);
  const note = input.note.trim();
  const startDate = parseDateOnly(input.startDate);

  if (name.length < 2 || name.length > 120) {
    throw new Error("Loan name must be between 2 and 120 characters.");
  }

  if (lender.length < 2 || lender.length > 120) {
    throw new Error("Lender name must be between 2 and 120 characters.");
  }

  if (input.loanType !== "standard" && input.loanType !== "no_cost_emi") {
    throw new Error("Please choose a valid loan type.");
  }

  if (!Number.isFinite(input.principalAmount) || input.principalAmount <= 0) {
    throw new Error("Loan amount must be greater than zero.");
  }

  if (!Number.isInteger(input.durationMonths) || input.durationMonths < 1 || input.durationMonths > 600) {
    throw new Error("Duration must be between 1 and 600 months.");
  }

  if (!startDate) {
    throw new Error("Start date must be a valid date.");
  }

  if (!Number.isInteger(input.emiPaymentDay) || input.emiPaymentDay < 1 || input.emiPaymentDay > 31) {
    throw new Error("EMI payment date must be between 1 and 31.");
  }

  if (!Number.isFinite(input.annualInterestRate) || input.annualInterestRate < 0 || input.annualInterestRate > 100) {
    throw new Error("Interest rate must be between 0 and 100.");
  }

  if (!Number.isFinite(input.plannedPrepaymentAmount) || input.plannedPrepaymentAmount < 0) {
    throw new Error("Prepayment amount must be zero or greater.");
  }

  if (note.length > 500) {
    throw new Error("Note must be 500 characters or fewer.");
  }

  await connectToDatabase();

  await DebtLoan.create({
    userId: new Types.ObjectId(userId),
    name,
    lender,
    loanType: input.loanType,
    principalAmount: roundCurrency(input.principalAmount),
    annualInterestRate: input.loanType === "no_cost_emi" ? 0 : roundCurrency(input.annualInterestRate),
    durationMonths: input.durationMonths,
    startDate,
    emiPaymentDay: input.emiPaymentDay,
    plannedPrepaymentAmount: roundCurrency(input.plannedPrepaymentAmount),
    note,
  });
}

export async function deleteDebtLoan(userId: string, loanId: string) {
  if (!Types.ObjectId.isValid(loanId)) {
    throw new Error("Invalid loan ID.");
  }

  await connectToDatabase();

  const deletedLoan = await DebtLoan.findOneAndDelete({
    _id: new Types.ObjectId(loanId),
    userId: new Types.ObjectId(userId),
  });

  if (!deletedLoan) {
    throw new Error("Loan not found.");
  }
}
