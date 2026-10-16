import YahooFinance from "yahoo-finance2";

import type { FinancialPeriod, PricePoint, StockFundamentals } from "@/lib/stock-model/types";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const FIELDS: Array<keyof FinancialPeriod> = [
  "totalRevenue", "grossProfit", "operatingIncome", "EBIT", "pretaxIncome", "netIncome", "dilutedEPS",
  "interestExpense", "totalAssets", "currentAssets", "currentLiabilities", "stockholdersEquity", "totalDebt",
  "longTermDebt", "cashAndCashEquivalents", "retainedEarnings", "operatingCashFlow", "capitalExpenditure",
  "freeCashFlow", "ordinarySharesNumber", "basicAverageShares",
];

function toPeriods(rows: Array<Record<string, unknown>>): FinancialPeriod[] {
  return rows
    .map((row) => {
      const date = row.date instanceof Date ? row.date : new Date(String(row.date));
      const period: FinancialPeriod = { date: date.toISOString().slice(0, 10) };
      for (const field of FIELDS) {
        const value = row[field];
        if (typeof value === "number" && Number.isFinite(value)) (period as Record<string, unknown>)[field] = value;
      }
      return period;
    })
    // Keep sparse older years too; metrics skip missing fields.
    .filter((period) => Object.keys(period).length > 1)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Monthly prices: raw close (undo later splits) plus split- and dividend-adjusted close. */
async function fetchMonthlyPrices(symbol: string, from: string): Promise<PricePoint[]> {
  const chart = await yahooFinance.chart(symbol, { period1: from, interval: "1mo", events: "split" });
  const splits = (chart.events?.splits || []).map((split) => ({
    time: new Date(split.date).getTime(),
    factor: split.numerator && split.denominator ? split.numerator / split.denominator : 1,
  }));

  return chart.quotes
    .filter((quote) => typeof quote.close === "number")
    .map((quote) => {
      const time = new Date(quote.date).getTime();
      const laterSplits = splits.filter((split) => split.time > time).reduce((product, split) => product * split.factor, 1);
      return {
        date: new Date(quote.date).toISOString().slice(0, 10),
        close: (quote.close as number) * laterSplits,
        adjClose: typeof quote.adjclose === "number" ? quote.adjclose : (quote.close as number),
      };
    });
}

export async function fetchStockFundamentals(symbol: string, options: { priceFrom?: string } = {}): Promise<StockFundamentals> {
  const [annual, quarterly, profile, prices] = await Promise.all([
    yahooFinance.fundamentalsTimeSeries(symbol, { period1: "2015-01-01", type: "annual", module: "all" }),
    yahooFinance.fundamentalsTimeSeries(symbol, { period1: "2022-01-01", type: "quarterly", module: "all" }).catch(() => []),
    yahooFinance.quoteSummary(symbol, { modules: ["assetProfile", "price"] }).catch(() => null),
    fetchMonthlyPrices(symbol, options.priceFrom || "2015-01-01"),
  ]);

  return {
    symbol,
    name: profile?.price?.longName || profile?.price?.shortName || symbol,
    sector: profile?.assetProfile?.sector || null,
    industry: profile?.assetProfile?.industry || null,
    annual: toPeriods(annual as Array<Record<string, unknown>>),
    quarterly: toPeriods(quarterly as Array<Record<string, unknown>>),
    prices,
  };
}
