import type { AdvisorMetrics, AdvisorProfile, AdvisorScore } from "@/lib/advisor.types";

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Linear interpolation through (x, score) breakpoints, clamped at both ends. */
export function scoreFromBreakpoints(value: number, points: Array<[number, number]>) {
  if (value <= points[0][0]) return points[0][1];

  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1];
    const [x2, y2] = points[index];

    if (value <= x2) {
      return Math.round(y1 + ((value - x1) / (x2 - x1)) * (y2 - y1));
    }
  }

  return points[points.length - 1][1];
}

export type AdvisorMetricInput = {
  asOf: Date;
  profile: AdvisorProfile;
  summary: {
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
    totalInvested: number;
    totalGainLossPercent: number;
    xirr: number | null;
  };
  allocation: Array<{ key: string; label: string; value: number; percentage: number }>;
  cashBalance: number;
  stocks: Array<{ name: string; value: number; returnsPercent: number }>;
  stocksReturnsPercent: number;
  funds: Array<{ name: string; value: number; category: string }>;
  fundsReturnsPercent: number;
  spending: {
    cycleSpent: number;
    budget: number | null;
    projected: number;
    status: string;
    previousCycleSpent: number | null;
    topCategories: Array<{ label: string; amount: number }>;
  } | null;
  loans: Array<{ name: string; annualRate: number | null; outstanding: number; emi: number; monthsLeft: number | null }>;
  goals: Array<{ name: string; progressPct: number; status: string; requiredMonthly: number | null; targetDate: string | null }>;
};

/**
 * Turns raw portfolio data into the ratios and 0-100 sub-scores the advisor reasons
 * about. Pure and deterministic so every number shown is reproducible.
 */
export function computeAdvisorMetrics(input: AdvisorMetricInput): AdvisorMetrics {
  const income = input.profile.monthlyIncome && input.profile.monthlyIncome > 0 ? input.profile.monthlyIncome : null;
  const monthlyEmi = round(input.loans.reduce((sum, loan) => sum + loan.emi, 0));
  const spending = input.spending;
  // Typical month: the larger of last cycle and this cycle's projection (budget as fallback).
  const monthlySpend = round(
    spending
      ? Math.max(spending.previousCycleSpent || 0, spending.projected, 0) || spending.budget || 0
      : 0
  );
  const outgoings = monthlySpend + monthlyEmi;
  const monthlySurplus = income != null ? round(income - outgoings) : null;
  const savingsRate = income != null && monthlySurplus != null ? round((monthlySurplus / income) * 100, 1) : null;
  const emergencyMonths = outgoings > 0 ? round(input.cashBalance / outgoings, 1) : null;
  const emiToIncome = income != null ? round((monthlyEmi / income) * 100, 1) : null;
  const debtToAssets = input.summary.totalAssets > 0
    ? round((input.summary.totalLiabilities / input.summary.totalAssets) * 100, 1)
    : 0;

  const stockTotal = input.stocks.reduce((sum, stock) => sum + stock.value, 0);
  const fundTotal = input.funds.reduce((sum, fund) => sum + fund.value, 0);
  const sortedStocks = [...input.stocks].sort((a, b) => b.value - a.value);
  const sortedFunds = [...input.funds].sort((a, b) => b.value - a.value);
  const byReturn = [...input.stocks].sort((a, b) => b.returnsPercent - a.returnsPercent);
  const categoryTotals = new Map<string, number>();

  for (const fund of input.funds) {
    categoryTotals.set(fund.category, (categoryTotals.get(fund.category) || 0) + fund.value);
  }

  const categories = [...categoryTotals.entries()]
    .map(([label, value]) => ({ label, percent: fundTotal ? round((value / fundTotal) * 100, 1) : 0 }))
    .sort((a, b) => b.percent - a.percent);
  const smallCapPercent = categories.find((category) => /small/i.test(category.label))?.percent || 0;
  const equityValue =
    (input.allocation.find((item) => item.key === "stocks")?.value || 0) +
    (input.allocation.find((item) => item.key === "mutualFunds")?.value || 0);
  const topClassPercent = Math.max(0, ...input.allocation.map((item) => item.percentage));

  const scores: AdvisorScore[] = [];

  if (emergencyMonths != null) {
    scores.push({
      key: "emergency",
      label: "Emergency fund",
      score: scoreFromBreakpoints(emergencyMonths, [[0, 0], [1, 25], [3, 60], [6, 100]]),
      detail: `${emergencyMonths} months of expenses and EMIs covered by cash`,
    });
  }

  scores.push(
    input.summary.totalLiabilities <= 0
      ? { key: "debt", label: "Debt load", score: 100, detail: "No outstanding debt" }
      : emiToIncome != null
        ? {
            key: "debt",
            label: "Debt load",
            score: scoreFromBreakpoints(emiToIncome, [[20, 100], [40, 40], [50, 10]]),
            detail: `EMIs take ${emiToIncome}% of income`,
          }
        : {
            key: "debt",
            label: "Debt load",
            score: scoreFromBreakpoints(debtToAssets, [[20, 100], [50, 50], [80, 10]]),
            detail: `Debt is ${debtToAssets}% of assets`,
          }
  );

  if (input.summary.totalAssets > 0) {
    const classScore = scoreFromBreakpoints(topClassPercent, [[50, 100], [70, 60], [90, 20]]);
    const smallCapScore = fundTotal ? scoreFromBreakpoints(smallCapPercent, [[35, 100], [60, 50], [80, 20]]) : 100;
    const topStockPercent = stockTotal && sortedStocks[0] ? (sortedStocks[0].value / stockTotal) * 100 : 0;
    const stockScore = scoreFromBreakpoints(topStockPercent, [[20, 100], [35, 60], [60, 20]]);

    scores.push({
      key: "diversification",
      label: "Diversification",
      score: Math.round((classScore + smallCapScore + stockScore) / 3),
      detail: `Largest asset class ${round(topClassPercent, 1)}% · small caps ${smallCapPercent}% of funds`,
    });
  }

  if (spending) {
    const spendScores: Record<string, number> = { on_track: 100, over_pace: 65, over_budget: 30, needs_budget: 60 };
    scores.push({
      key: "spending",
      label: "Spending discipline",
      score: spendScores[spending.status] ?? 60,
      detail: spending.budget
        ? `Projected ₹${Math.round(spending.projected).toLocaleString("en-IN")} of ₹${Math.round(spending.budget).toLocaleString("en-IN")} budget`
        : "No budget set",
    });
  }

  if (savingsRate != null) {
    scores.push({
      key: "savings",
      label: "Savings rate",
      score: savingsRate < 0 ? 0 : scoreFromBreakpoints(savingsRate, [[0, 20], [10, 50], [20, 75], [30, 100]]),
      detail: `${savingsRate}% of income left after spending and EMIs`,
    });
  }

  const datedGoals = input.goals.filter((goal) => goal.status !== "no_date");

  if (datedGoals.length) {
    const healthy = datedGoals.filter((goal) => goal.status === "on_track" || goal.status === "completed").length;
    scores.push({
      key: "goals",
      label: "Goals on track",
      score: Math.round((healthy / datedGoals.length) * 100),
      detail: `${healthy} of ${datedGoals.length} dated goals on track`,
    });
  }

  return {
    asOf: input.asOf.toISOString(),
    netWorth: round(input.summary.netWorth),
    totalAssets: round(input.summary.totalAssets),
    totalLiabilities: round(input.summary.totalLiabilities),
    invested: round(input.summary.totalInvested),
    returnsPercent: round(input.summary.totalGainLossPercent),
    xirr: input.summary.xirr,
    monthlyIncome: income,
    monthlySpend,
    monthlyEmi,
    monthlySurplus,
    savingsRate,
    emergencyMonths,
    emiToIncome,
    debtToAssets,
    allocation: input.allocation.map((item) => ({
      key: item.key,
      label: item.label,
      value: round(item.value),
      percent: round(item.percentage, 1),
    })),
    equityPercent: input.summary.totalAssets ? round((equityValue / input.summary.totalAssets) * 100, 1) : 0,
    stocks: {
      count: input.stocks.length,
      value: round(stockTotal),
      returnsPercent: round(input.stocksReturnsPercent),
      lossMakers: input.stocks.filter((stock) => stock.returnsPercent < 0).length,
      topHolding: sortedStocks[0]
        ? { name: sortedStocks[0].name, percent: round((sortedStocks[0].value / stockTotal) * 100, 1) }
        : null,
      best: byReturn.slice(0, 3).map((stock) => ({ name: stock.name, returnsPercent: round(stock.returnsPercent) })),
      worst: byReturn
        .slice(-3)
        .reverse()
        .filter((stock) => stock.returnsPercent < 0)
        .map((stock) => ({ name: stock.name, returnsPercent: round(stock.returnsPercent) })),
    },
    funds: {
      count: input.funds.length,
      value: round(fundTotal),
      returnsPercent: round(input.fundsReturnsPercent),
      topHolding: sortedFunds[0]
        ? { name: sortedFunds[0].name, percent: round((sortedFunds[0].value / fundTotal) * 100, 1) }
        : null,
      categories,
      smallCapPercent,
    },
    spending: spending
      ? { ...spending, cycleSpent: round(spending.cycleSpent), projected: round(spending.projected) }
      : { cycleSpent: 0, budget: null, projected: 0, status: "needs_budget", previousCycleSpent: null, topCategories: [] },
    debt: input.loans,
    goals: input.goals,
    scores,
    healthScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score.score, 0) / scores.length) : 0,
  };
}
