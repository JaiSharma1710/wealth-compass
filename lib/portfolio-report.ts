import "server-only";

import type { SafeUser } from "@/lib/auth";
import { getCashReserveDashboard } from "@/lib/cash-reserves";
import { getDebtLoanTypeLabel, getDebtPageData } from "@/lib/debt";
import { getGoldDashboard } from "@/lib/gold";
import { GOLD_INVESTMENT_OPTIONS } from "@/lib/gold.types";
import { getMutualFundDashboard } from "@/lib/mutual-funds";
import { getStockDashboard } from "@/lib/stocks";
import { CashReserveEntry } from "@/lib/models/cash-reserve-entry";
import { GoldTransaction } from "@/lib/models/gold-transaction";

type PortfolioReportFormat = "xls" | "pdf";

type ReportSection = {
  title: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
};

type PortfolioReport = {
  user: SafeUser;
  generatedAt: string;
  sections: ReportSection[];
};

type GoldTransactionRecord = {
  _id: { toString(): string } | string;
  investmentOption: string;
  schemeName: string;
  units?: number | null;
  transactionType: string;
  investedAmount?: number | null;
  currentValue?: number | null;
  sellAmount?: number | null;
  realizedCostBasisAmount?: number | null;
  realizedProfitAmount?: number | null;
  transactionDate: Date;
};

type CashReserveEntryRecord = {
  _id: { toString(): string } | string;
  entryDate: Date;
  amount: number;
  entryType: string;
  bank: string;
  note?: string | null;
};

const REPORT_FILE_BASENAME = "wealth-compass-portfolio-report";

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function calculateAge(dateOfBirth: string) {
  if (!dateOfBirth) {
    return "";
  }

  const birthDate = new Date(`${dateOfBirth}T00:00:00`);

  if (Number.isNaN(birthDate.getTime())) {
    return "";
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age >= 0 ? age : "";
}

function getGoldOptionLabel(value: string) {
  return GOLD_INVESTMENT_OPTIONS.find((option) => option.value === value)?.label || value;
}

function getCellValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return value;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(getCellValue(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toPdfText(value: string | number | null | undefined) {
  return String(getCellValue(value))
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function slugifyFilenamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildProfileRows(user: SafeUser, generatedAt: string): ReportSection {
  return {
    title: "User Profile",
    headers: ["Field", "Value"],
    rows: [
      ["Name", user.fullName],
      ["Username", user.profile.username],
      ["Email", user.email],
      ["Age", calculateAge(user.profile.dateOfBirth)],
      ["Date of birth", user.profile.dateOfBirth],
      ["Currency", user.profile.currency],
      ["Country", user.profile.country],
      ["City", user.profile.city],
      ["Postal code", user.profile.postalCode],
      ["Present address", user.profile.presentAddress],
      ["Permanent address", user.profile.permanentAddress],
      ["Registered banks", user.profile.banks.join(", ")],
      ["Report generated", formatDateTime(generatedAt)],
    ],
  };
}

export async function buildPortfolioReport(user: SafeUser): Promise<PortfolioReport> {
  const [stocks, mutualFunds, gold, cash, debt, goldTransactions, cashEntries] = await Promise.all([
    getStockDashboard(user.id),
    getMutualFundDashboard(user.id),
    getGoldDashboard(user.id),
    getCashReserveDashboard(user.id),
    getDebtPageData(user.id),
    GoldTransaction.find({ userId: user.id })
      .sort({ transactionDate: -1, createdAt: -1 })
      .lean() as Promise<GoldTransactionRecord[]>,
    CashReserveEntry.find({ userId: user.id })
      .sort({ entryDate: -1, createdAt: -1 })
      .lean() as Promise<CashReserveEntryRecord[]>,
  ]);

  const totalCurrentValue = roundCurrency(
    stocks.totalCurrentValue +
      mutualFunds.totalPortfolioValue +
      gold.totalCurrentValue +
      cash.totalBalance
  );
  const totalInvested = roundCurrency(
    stocks.totalInvestedAmount +
      mutualFunds.totalInvestedAmount +
      gold.totalInvestedAmount +
      cash.totalBalance
  );
  const totalGainLoss = roundCurrency(totalCurrentValue - totalInvested);
  const totalGainLossPct = totalInvested ? roundCurrency((totalGainLoss / totalInvested) * 100) : 0;
  const generatedAt = new Date().toISOString();

  const sections: ReportSection[] = [
    buildProfileRows(user, generatedAt),
    {
      title: "Portfolio Summary",
      headers: ["Asset class", "Current value", "Invested amount", "Gain / loss", "Gain / loss %", "Holdings"],
      rows: [
        ["Stocks", stocks.totalCurrentValue, stocks.totalInvestedAmount, stocks.totalUnrealizedProfit, stocks.totalUnrealizedProfitPercent, stocks.holdingCount],
        ["Mutual Funds", mutualFunds.totalPortfolioValue, mutualFunds.totalInvestedAmount, mutualFunds.totalProfitLossAmount, mutualFunds.totalProfitLossPct, mutualFunds.holdings.length],
        ["Gold", gold.totalCurrentValue, gold.totalInvestedAmount, gold.totalProfitLossAmount, gold.totalProfitLossPct, gold.holdings.length],
        ["Cash and Reserves", cash.totalBalance, cash.totalBalance, 0, 0, cash.bankDistribution.length],
        ["Total", totalCurrentValue, totalInvested, totalGainLoss, totalGainLossPct, ""],
      ],
    },
    {
      title: "Debt Summary",
      headers: ["Metric", "Value"],
      rows: [
        ["Total loans", debt.overview.totalLoans],
        ["Active loans", debt.overview.activeLoans],
        ["Closed loans", debt.overview.closedLoans],
        ["Original principal", debt.overview.totalOriginalPrincipal],
        ["Outstanding principal", debt.overview.totalOutstandingPrincipal],
        ["Paid amount", debt.overview.totalPaidAmount],
        ["Paid principal", debt.overview.totalPaidPrincipal],
        ["Paid interest", debt.overview.totalPaidInterest],
        ["Remaining amount", debt.overview.totalRemainingAmount],
        ["Total interest payable", debt.overview.totalInterestPayable],
        ["Next EMI date", debt.overview.nextEmiDate ? formatDate(debt.overview.nextEmiDate) : ""],
        ["Next EMI amount", debt.overview.nextEmiAmount],
      ],
    },
    {
      title: "Debt Loans",
      headers: [
        "Loan",
        "Lender",
        "Type",
        "Principal",
        "Interest %",
        "Duration months",
        "EMI date",
        "EMI amount",
        "Paid principal",
        "Paid interest",
        "Outstanding principal",
        "Remaining amount",
        "Progress %",
        "Expected closure",
      ],
      rows: debt.loans.map((loan) => [
        loan.name,
        loan.lender,
        getDebtLoanTypeLabel(loan.loanType),
        loan.principalAmount,
        loan.annualInterestRate,
        loan.durationMonths,
        loan.emiPaymentDay,
        loan.emiAmount,
        loan.paidPrincipal,
        loan.paidInterest,
        loan.remainingPrincipal,
        loan.remainingAmount,
        loan.progressPct,
        loan.expectedClosureDate ? formatDate(loan.expectedClosureDate) : "",
      ]),
    },
    ...debt.loans.map((loan): ReportSection => ({
      title: `Debt Schedule - ${loan.name}`,
      headers: [
        "Installment",
        "Due date",
        "Opening balance",
        "EMI",
        "Principal",
        "Interest",
        "Prepayment",
        "Total payment",
        "Closing balance",
        "Status",
      ],
      rows: loan.schedule.map((row) => [
        row.installmentNumber,
        formatDate(row.dueDate),
        row.openingBalance,
        row.emiAmount,
        row.principalPaid,
        row.interestPaid,
        row.prepaymentAmount,
        row.totalPayment,
        row.closingBalance,
        row.isPaid ? "Paid" : "Pending",
      ]),
    })),
    {
      title: "Stock Holdings",
      headers: [
        "Symbol",
        "Company",
        "Exchange",
        "Quantity",
        "Average price",
        "Invested amount",
        "Current price",
        "Current value",
        "Unrealized profit",
        "Unrealized profit %",
        "Today P&L",
        "Allocation %",
        "Opened at",
        "Last quote at",
      ],
      rows: stocks.holdings.map((holding) => [
        holding.symbol,
        holding.companyName,
        holding.exchange,
        holding.quantity,
        holding.averagePrice,
        holding.investedAmount,
        holding.currentPrice,
        holding.currentValue,
        holding.unrealizedProfit,
        holding.unrealizedProfitPercent,
        holding.todayPnL,
        holding.allocationPercent,
        formatDate(holding.openedAt),
        holding.lastQuoteAt ? formatDateTime(holding.lastQuoteAt) : "",
      ]),
    },
    {
      title: "Mutual Fund Holdings",
      headers: [
        "Scheme code",
        "Scheme name",
        "Units",
        "Average NAV",
        "Invested amount",
        "Current NAV",
        "Current value",
        "Profit / loss",
        "Profit / loss %",
        "Allocation %",
        "Last NAV at",
      ],
      rows: mutualFunds.holdings.map((holding) => [
        holding.schemeCode,
        holding.schemeName,
        holding.units,
        holding.averageNav,
        holding.investedAmount,
        holding.currentNav,
        holding.currentValue,
        holding.profitLossAmount,
        holding.profitLossPct,
        holding.allocationPct,
        holding.lastNavAt ? formatDateTime(holding.lastNavAt) : "",
      ]),
    },
    {
      title: "Gold Holdings",
      headers: [
        "Investment option",
        "Scheme / item",
        "Units",
        "Invested amount",
        "Current value",
        "Profit / loss",
        "Profit / loss %",
      ],
      rows: gold.holdings.map((holding) => [
        holding.investmentOptionLabel,
        holding.schemeName,
        holding.units,
        holding.investedAmount,
        holding.currentValue,
        holding.profitLossAmount,
        holding.profitLossPct,
      ]),
    },
    {
      title: "Bank Wise Cash and Reserves",
      headers: ["Bank", "Balance", "Allocation %"],
      rows: cash.bankDistribution.map((entry) => [entry.bank, entry.balance, entry.percentage]),
    },
    {
      title: "Stock Transactions",
      headers: [
        "Date",
        "Type",
        "Symbol",
        "Company",
        "Quantity",
        "Price",
        "Gross amount",
        "Charges",
        "Net amount",
        "Cost basis",
        "Realized profit",
        "Note",
      ],
      rows: stocks.transactions.map((transaction) => [
        formatDate(transaction.transactionDate),
        transaction.type,
        transaction.symbol,
        transaction.companyName,
        transaction.quantity,
        transaction.price,
        transaction.buyGrossAmount ?? transaction.sellGrossAmount,
        transaction.buyCharges ?? transaction.sellCharges,
        transaction.buyNetAmount ?? transaction.sellNetAmount,
        transaction.costBasis,
        transaction.realizedProfitForSell,
        transaction.note,
      ]),
    },
    {
      title: "Mutual Fund Transactions",
      headers: [
        "Date",
        "Type",
        "Scheme code",
        "Scheme name",
        "Units",
        "NAV",
        "Amount",
        "Average buy NAV",
        "Realized profit",
        "Realized profit %",
      ],
      rows: mutualFunds.recentTransactions.map((transaction) => [
        formatDate(transaction.date),
        transaction.transactionType,
        transaction.schemeCode,
        transaction.schemeName,
        transaction.units,
        transaction.nav,
        transaction.amount,
        transaction.averageBuyNav,
        transaction.realizedProfitAmount,
        transaction.realizedProfitPct,
      ]),
    },
    {
      title: "Gold Transactions",
      headers: [
        "Date",
        "Type",
        "Investment option",
        "Scheme / item",
        "Units",
        "Invested amount",
        "Current value",
        "Sell amount",
        "Realized cost basis",
        "Realized profit",
      ],
      rows: goldTransactions.map((transaction) => [
        formatDate(transaction.transactionDate),
        transaction.transactionType,
        getGoldOptionLabel(transaction.investmentOption),
        transaction.schemeName,
        transaction.units ?? null,
        transaction.investedAmount ?? null,
        transaction.currentValue ?? null,
        transaction.sellAmount ?? null,
        transaction.realizedCostBasisAmount ?? null,
        transaction.realizedProfitAmount ?? null,
      ]),
    },
    {
      title: "Cash and Reserve Entries",
      headers: ["Date", "Type", "Bank", "Amount", "Signed amount", "Note"],
      rows: cashEntries.map((entry) => [
        formatDate(entry.entryDate),
        entry.entryType,
        entry.bank,
        entry.amount,
        entry.entryType === "credit" ? entry.amount : -entry.amount,
        entry.note || "",
      ]),
    },
  ];

  return {
    user,
    generatedAt,
    sections,
  };
}

export function getPortfolioReportFilename(user: SafeUser, format: PortfolioReportFormat) {
  const userPart = slugifyFilenamePart(user.fullName) || "user";
  const datePart = new Date().toISOString().slice(0, 10);

  return `${REPORT_FILE_BASENAME}-${userPart}-${datePart}.${format}`;
}

export function renderPortfolioReportXls(report: PortfolioReport) {
  const sectionHtml = report.sections
    .map((section) => {
      const rows = section.rows.length ? section.rows : [["No records"]];

      return `
        <h2>${escapeHtml(section.title)}</h2>
        <table>
          <thead>
            <tr>${section.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
              .join("")}
          </tbody>
        </table>
      `;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; color: #111111; }
      h1 { font-size: 20px; margin: 0 0 6px; }
      h2 { font-size: 16px; margin: 24px 0 8px; }
      p { margin: 0 0 16px; color: #4b5563; }
      table { border-collapse: collapse; margin-bottom: 16px; }
      th { background: #edf2f7; font-weight: 700; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; mso-number-format: "\\@"; }
    </style>
  </head>
  <body>
    <h1>Wealth Compass Portfolio Report</h1>
    <p>Generated for ${escapeHtml(report.user.fullName)} on ${escapeHtml(formatDateTime(report.generatedAt))}</p>
    ${sectionHtml}
  </body>
</html>`;
}

function createPdfLineChunks(report: PortfolioReport) {
  const lines: string[] = [
    "Wealth Compass Portfolio Report",
    `Generated for ${report.user.fullName} on ${formatDateTime(report.generatedAt)}`,
    "",
  ];

  for (const section of report.sections) {
    lines.push(section.title);
    lines.push(section.headers.join(" | "));

    if (!section.rows.length) {
      lines.push("No records");
      lines.push("");
      continue;
    }

    for (const row of section.rows) {
      const rowText = row.map((cell) => String(getCellValue(cell))).join(" | ");
      const chunks = rowText.match(/.{1,110}(\s|$)|.{1,110}/g) || [rowText];

      lines.push(...chunks.map((chunk) => chunk.trim()));
    }

    lines.push("");
  }

  return lines;
}

function renderPdfPageContent(lines: string[]) {
  const body = lines
    .map((line) => `(${toPdfText(line)}) Tj 0 -13 Td`)
    .join("\n");

  return `BT
/F1 9 Tf
40 800 Td
${body}
ET`;
}

export function renderPortfolioReportPdf(report: PortfolioReport) {
  const lines = createPdfLineChunks(report);
  const linesPerPage = 58;
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / linesPerPage)) }, (_, index) =>
    lines.slice(index * linesPerPage, (index + 1) * linesPerPage)
  );
  const objects = new Map<number, string>();
  const pageObjectIds: number[] = [];
  const fontObjectId = 3;

  objects.set(fontObjectId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((pageLines, index) => {
    const pageObjectId = 4 + index * 2;
    const contentObjectId = pageObjectId + 1;
    const content = renderPdfPageContent(pageLines);

    pageObjectIds.push(pageObjectId);
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objects.set(
      contentObjectId,
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>
stream
${content}
endstream`
    );
  });

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`
  );

  const maxObjectId = Math.max(...objects.keys());
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id <= maxObjectId; id += 1) {
    const object = objects.get(id);

    if (!object) {
      offsets[id] = 0;
      continue;
    }

    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${maxObjectId + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id <= maxObjectId; id += 1) {
    pdf += `${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
