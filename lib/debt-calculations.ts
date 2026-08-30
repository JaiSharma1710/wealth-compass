import type { DebtScheduleRow } from "@/lib/debt.types";

const BALANCE_EPSILON = 0.01;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function createEmiDate(startDate: Date, monthOffset: number, emiPaymentDay: number) {
  const year = startDate.getFullYear();
  const month = startDate.getMonth() + monthOffset;
  const target = new Date(year, month, 1);
  const day = Math.min(emiPaymentDay, getDaysInMonth(target.getFullYear(), target.getMonth()));

  return new Date(target.getFullYear(), target.getMonth(), day);
}

function calculateEmi(principal: number, annualInterestRate: number, durationMonths: number) {
  const monthlyRate = annualInterestRate / 12 / 100;

  if (monthlyRate <= 0) {
    return roundCurrency(principal / durationMonths);
  }

  const factor = Math.pow(1 + monthlyRate, durationMonths);

  return roundCurrency((principal * monthlyRate * factor) / (factor - 1));
}

export function calculateDebtSchedule(input: {
  principalAmount: number;
  annualInterestRate: number;
  durationMonths: number;
  startDate: Date;
  emiPaymentDay: number;
  plannedPrepaymentAmount: number;
  asOfDate?: Date;
}): DebtScheduleRow[] {
  const emiAmount = calculateEmi(
    input.principalAmount,
    input.annualInterestRate,
    input.durationMonths
  );
  const monthlyRate = input.annualInterestRate / 12 / 100;
  const asOfDate = input.asOfDate || new Date();
  const rows: DebtScheduleRow[] = [];
  let balance = roundCurrency(input.principalAmount);

  for (let index = 0; index < input.durationMonths && balance > BALANCE_EPSILON; index += 1) {
    const dueDate = createEmiDate(input.startDate, index, input.emiPaymentDay);
    const openingBalance = roundCurrency(balance);
    const interestPaid = roundCurrency(openingBalance * monthlyRate);
    const scheduledPayment = Math.min(emiAmount, roundCurrency(openingBalance + interestPaid));
    const principalFromEmi = roundCurrency(Math.max(scheduledPayment - interestPaid, 0));
    const prepaymentAmount = roundCurrency(
      Math.min(input.plannedPrepaymentAmount, Math.max(openingBalance - principalFromEmi, 0))
    );
    const principalPaid = roundCurrency(Math.min(openingBalance, principalFromEmi + prepaymentAmount));
    const closingBalance = roundCurrency(Math.max(openingBalance - principalPaid, 0));

    rows.push({
      installmentNumber: index + 1,
      dueDate: dueDate.toISOString(),
      openingBalance,
      emiAmount: scheduledPayment,
      principalPaid,
      interestPaid,
      prepaymentAmount,
      totalPayment: roundCurrency(scheduledPayment + prepaymentAmount),
      closingBalance,
      isPaid: dueDate <= asOfDate,
    });

    balance = closingBalance;
  }

  return rows;
}
