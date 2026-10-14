import "server-only";

import { Types } from "mongoose";

import { getAccountsDashboard } from "@/lib/accounts";
import { computeAdvisorMetrics } from "@/lib/advisor-metrics";
import {
  ADVISOR_SECTION_KEYS,
  RISK_PROFILES,
  type AdvisorAdvice,
  type AdvisorMetrics,
  type AdvisorProfile,
  type AdvisorReport,
  type RiskProfile,
} from "@/lib/advisor.types";
import type { SafeUser } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import { getTodayDateKey } from "@/lib/daily-values";
import { getDebtPageData } from "@/lib/debt";
import { getGoalsPageData } from "@/lib/goals";
import { AdvisorProfileModel, AdvisorReportModel } from "@/lib/models/advisor";
import { connectToDatabase } from "@/lib/mongodb";
import { getMutualFundDashboard } from "@/lib/mutual-funds";
import { generateStructured } from "@/lib/services/gemini.service";
import { getStockDashboard } from "@/lib/stocks";
import { estimateFundCategory } from "@/components/mutual-funds-categories";

const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;

function ageFromDateOfBirth(value: string) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  if (now < new Date(now.getFullYear(), date.getMonth(), date.getDate())) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

export async function getAdvisorProfile(user: SafeUser): Promise<AdvisorProfile> {
  await connectToDatabase();

  const profile = await AdvisorProfileModel.findOne({ userId: new Types.ObjectId(user.id) }).lean();

  return {
    monthlyIncome: profile?.monthlyIncome ?? null,
    riskProfile: (profile?.riskProfile as RiskProfile) || "moderate",
    age: ageFromDateOfBirth(user.profile.dateOfBirth),
  };
}

export async function saveAdvisorProfile(
  user: SafeUser,
  input: { monthlyIncome?: number | null; riskProfile?: string }
) {
  const income = input.monthlyIncome == null || input.monthlyIncome === 0 ? null : Number(input.monthlyIncome);

  if (income != null && (!Number.isFinite(income) || income < 0)) {
    throw new Error("Monthly income must be zero or more.");
  }

  const riskProfile = RISK_PROFILES.includes(input.riskProfile as RiskProfile)
    ? (input.riskProfile as RiskProfile)
    : "moderate";

  await connectToDatabase();
  await AdvisorProfileModel.updateOne(
    { userId: new Types.ObjectId(user.id) },
    { $set: { monthlyIncome: income, riskProfile } },
    { upsert: true }
  );
  // Inputs changed, so today's cached analysis is stale.
  await AdvisorReportModel.deleteMany({ userId: new Types.ObjectId(user.id), date: getTodayDateKey() });
}

export async function getAdvisorMetrics(user: SafeUser): Promise<AdvisorMetrics> {
  const [profile, dashboard, stocks, funds, debt, accounts, goals] = await Promise.all([
    getAdvisorProfile(user),
    getDashboard(user),
    getStockDashboard(user.id),
    getMutualFundDashboard(user.id),
    getDebtPageData(user.id),
    getAccountsDashboard(user.id),
    getGoalsPageData(user),
  ]);
  const flow = dashboard.cashFlow;

  return computeAdvisorMetrics({
    asOf: new Date(),
    profile,
    summary: {
      netWorth: dashboard.summary.netWorth,
      totalAssets: dashboard.summary.totalAssets,
      totalLiabilities: dashboard.summary.totalLiabilities,
      totalInvested: dashboard.summary.totalInvested,
      totalGainLossPercent: dashboard.summary.totalGainLossPercent,
      xirr: dashboard.summary.xirr,
    },
    allocation: dashboard.allocation.map((item) => ({ ...item })),
    cashBalance: dashboard.assetClasses.find((assetClass) => assetClass.key === "cash")?.currentValue || 0,
    stocks: stocks.holdings.map((holding) => ({
      name: holding.symbol.replace(/\.(NS|BO)$/, ""),
      value: holding.currentValue,
      returnsPercent: holding.unrealizedProfitPercent,
    })),
    stocksReturnsPercent: stocks.totalUnrealizedProfitPercent,
    funds: funds.holdings.map((holding) => ({
      name: holding.schemeName,
      value: holding.currentValue,
      category: estimateFundCategory(holding.schemeName),
    })),
    fundsReturnsPercent: funds.totalProfitLossPct,
    spending: flow
      ? {
          cycleSpent: flow.spent,
          budget: flow.budget,
          projected: flow.projectedSpend,
          status: flow.status,
          previousCycleSpent: flow.previousCycleSpent,
          topCategories: flow.topCategories.map((category) => ({ label: category.label, amount: category.amount })),
        }
      : null,
    loans: [
      ...debt.loans
        .filter((loan) => loan.remainingPrincipal > 0)
        .map((loan) => ({
          name: loan.name,
          annualRate: loan.annualInterestRate,
          outstanding: loan.remainingPrincipal,
          emi: loan.emiAmount,
          monthsLeft: loan.remainingInstallments,
        })),
      ...accounts.liabilities.map((account) => ({
        name: account.name,
        annualRate: account.interestRate,
        outstanding: account.currentValue,
        emi: account.monthlyPayment || 0,
        monthsLeft: null,
      })),
    ],
    goals: goals.goals.map((goal) => ({
      name: goal.name,
      progressPct: goal.progressPct,
      status: goal.status,
      requiredMonthly: goal.requiredMonthly,
      targetDate: goal.targetDate,
    })),
  });
}

const SYSTEM_PROMPT = `You are a careful, fee-only personal finance advisor for an Indian retail investor.
Rules:
- Use ONLY the numbers in the provided metrics JSON. Never invent balances, returns, prices or rates. If something is unknown (e.g. income is null), say what is missing and how it limits the advice.
- Amounts are in INR. Write amounts like ₹12,500 or ₹1.2L. Be specific and quantitative, referencing the metrics.
- Indian context: emergency fund (6 months of expenses + EMIs), 80C/ELSS, PPF, NPS, index funds, prepaying high-interest loans vs investing (compare loan rate with ~10-12% long-run equity expectation), avoiding over-concentration in small caps or single stocks, term & health insurance.
- Respect the risk profile and age when suggesting a target asset allocation. targetAllocation percents must sum to 100 and use these keys only: stocks, mutualFunds, gold, cash, otherAssets.
- moneyFlow: split the monthly investable surplus (metrics.monthlySurplus; if null, propose a plan for a stated assumed amount and explain the assumption in basis). Allocation amounts must sum to monthlyAmount.
- actions: 3 to 5, ordered by priority (1 = do first), each concrete and doable this month.
- sections: exactly one entry for each key: investments, spending, debt, cash, goals. Status: good, watch, or act. Keep each summary to 1-2 sentences; wins/issues max 3 short items each; nextStep is one sentence.
- This is educational guidance, not a SEBI-registered recommendation; do not tell the user to buy a specific stock.
- Tone: direct, encouraging, plain English. No markdown.`;

const STRING = { type: "STRING" };
const NUMBER = { type: "NUMBER" };
const STRING_LIST = { type: "ARRAY", items: STRING };

const ADVICE_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: STRING,
    verdict: STRING,
    actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { priority: { type: "INTEGER" }, title: STRING, detail: STRING, impact: STRING },
        required: ["priority", "title", "detail", "impact"],
      },
    },
    moneyFlow: {
      type: "OBJECT",
      properties: {
        monthlyAmount: NUMBER,
        basis: STRING,
        allocations: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { label: STRING, amount: NUMBER, reason: STRING },
            required: ["label", "amount", "reason"],
          },
        },
      },
      required: ["monthlyAmount", "basis", "allocations"],
    },
    targetAllocation: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          key: { type: "STRING", enum: ["stocks", "mutualFunds", "gold", "cash", "otherAssets"] },
          percent: NUMBER,
        },
        required: ["key", "percent"],
      },
    },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          key: { type: "STRING", enum: [...ADVISOR_SECTION_KEYS] },
          status: { type: "STRING", enum: ["good", "watch", "act"] },
          summary: STRING,
          wins: STRING_LIST,
          issues: STRING_LIST,
          nextStep: STRING,
        },
        required: ["key", "status", "summary", "wins", "issues", "nextStep"],
      },
    },
  },
  required: ["headline", "verdict", "actions", "moneyFlow", "targetAllocation", "sections"],
};

function toReport(doc: { advice: unknown; model?: string | null; generatedAt: Date }): AdvisorReport {
  return {
    advice: doc.advice as AdvisorAdvice,
    model: doc.model || "",
    generatedAt: doc.generatedAt.toISOString(),
    nextRefreshAt: new Date(doc.generatedAt.getTime() + REFRESH_COOLDOWN_MS).toISOString(),
  };
}

/**
 * Today's AI analysis. Generated once per day (on first visit) and cached; `force`
 * regenerates after a short cooldown.
 */
export async function getAdvisorReport(
  user: SafeUser,
  options: { force?: boolean; metrics?: AdvisorMetrics } = {}
): Promise<AdvisorReport> {
  await connectToDatabase();

  const userId = new Types.ObjectId(user.id);
  const today = getTodayDateKey();
  const latest = await AdvisorReportModel.findOne({ userId }).sort({ generatedAt: -1 }).lean();

  if (latest && latest.date === today && !options.force) {
    return toReport(latest);
  }

  if (options.force && latest && Date.now() - latest.generatedAt.getTime() < REFRESH_COOLDOWN_MS) {
    return toReport(latest);
  }

  const metrics = options.metrics || (await getAdvisorMetrics(user));
  const profile = await getAdvisorProfile(user);
  const { data, model } = await generateStructured<AdvisorAdvice>({
    system: SYSTEM_PROMPT,
    prompt: `Investor profile: ${JSON.stringify({ riskProfile: profile.riskProfile, age: profile.age })}
Metrics (as of ${today}): ${JSON.stringify(metrics)}
Give the analysis.`,
    schema: ADVICE_SCHEMA,
  });
  const generatedAt = new Date();

  await AdvisorReportModel.updateOne(
    { userId, date: today },
    { $set: { userId, date: today, advice: data, model, generatedAt } },
    { upsert: true }
  );

  return toReport({ advice: data, model, generatedAt });
}
