import "server-only";

import YahooFinance from "yahoo-finance2";

import type {
  StockChartPoint,
  StockDividendItem,
  StockNewsItem,
  StockQuote,
  StockSearchResult,
  StockSplitItem,
} from "@/lib/stocks.types";

const yahooFinance = new YahooFinance();
const OPEN_MARKET_STATES = new Set(["REGULAR", "PRE", "PREPRE", "POST"]);

function resolveChartPeriod(range: string) {
  const now = new Date();
  const period1 = new Date(now);

  switch (range) {
    case "1d":
      period1.setDate(period1.getDate() - 1);
      return { period1, interval: "5m" as const };
    case "1wk":
      period1.setDate(period1.getDate() - 7);
      return { period1, interval: "1h" as const };
    case "1mo":
      period1.setMonth(period1.getMonth() - 1);
      return { period1, interval: "1d" as const };
    case "6mo":
      period1.setMonth(period1.getMonth() - 6);
      return { period1, interval: "1wk" as const };
    case "1y":
      period1.setFullYear(period1.getFullYear() - 1);
      return { period1, interval: "1mo" as const };
    default:
      period1.setMonth(period1.getMonth() - 6);
      return { period1, interval: "1wk" as const };
  }
}

function normalizeSearchResult(result: Record<string, unknown>): StockSearchResult | null {
  if (
    typeof result.symbol !== "string" ||
    typeof result.exchange !== "string" ||
    (result.quoteType !== "EQUITY" && result.quoteType !== "ETF")
  ) {
    return null;
  }

  return {
    symbol: result.symbol,
    exchange: result.exchange,
    companyName:
      (typeof result.longname === "string" && result.longname) ||
      (typeof result.shortname === "string" && result.shortname) ||
      result.symbol,
    shortName:
      (typeof result.shortname === "string" && result.shortname) ||
      (typeof result.longname === "string" && result.longname) ||
      result.symbol,
    quoteType: result.quoteType,
    sector: typeof result.sector === "string" ? result.sector : null,
    industry: typeof result.industry === "string" ? result.industry : null,
  };
}

function normalizeQuote(quote: Record<string, unknown> | null | undefined): StockQuote | null {
  if (!quote || typeof quote.symbol !== "string") {
    return null;
  }

  return {
    symbol: quote.symbol,
    exchange: typeof quote.exchange === "string" ? quote.exchange : null,
    currency: typeof quote.currency === "string" ? quote.currency : null,
    shortName: typeof quote.shortName === "string" ? quote.shortName : null,
    longName: typeof quote.longName === "string" ? quote.longName : null,
    quoteType: typeof quote.quoteType === "string" ? quote.quoteType : null,
    regularMarketPrice:
      typeof quote.regularMarketPrice === "number" ? quote.regularMarketPrice : null,
    regularMarketChange:
      typeof quote.regularMarketChange === "number" ? quote.regularMarketChange : null,
    regularMarketChangePercent:
      typeof quote.regularMarketChangePercent === "number"
        ? quote.regularMarketChangePercent
        : null,
    regularMarketPreviousClose:
      typeof quote.regularMarketPreviousClose === "number"
        ? quote.regularMarketPreviousClose
        : null,
    marketState: typeof quote.marketState === "string" ? quote.marketState : null,
    isMarketOpen:
      typeof quote.marketState === "string" && OPEN_MARKET_STATES.has(quote.marketState),
    sector: typeof quote.sector === "string" ? quote.sector : null,
    industry: typeof quote.industry === "string" ? quote.industry : null,
  };
}

export async function searchStocks(query: string) {
  const result = await yahooFinance.search(query, {
    quotesCount: 12,
    newsCount: 0,
  });

  return (result.quotes || [])
    .map((entry) => normalizeSearchResult(entry as Record<string, unknown>))
    .filter((entry): entry is StockSearchResult => Boolean(entry));
}

export async function getStockQuote(symbol: string) {
  const [quoteResult, chartResult] = await Promise.all([
    yahooFinance.quote(symbol),
    yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - 24 * 60 * 60 * 1000),
      period2: new Date(Date.now() + 24 * 60 * 60 * 1000),
      interval: "1d",
    }),
  ]);

  const normalized = normalizeQuote(quoteResult as unknown as Record<string, unknown>);

  if (!normalized) {
    return null;
  }

  const latestClose = [...(Array.isArray(chartResult.quotes) ? chartResult.quotes : [])]
    .reverse()
    .find((entry) => typeof entry.close === "number")?.close;

  if (!normalized.isMarketOpen && typeof latestClose === "number") {
    normalized.regularMarketPrice = latestClose;
  }

  return normalized;
}

export async function getBulkQuotes(symbols: string[]) {
  if (!symbols.length) {
    return {};
  }

  return Object.fromEntries(
    await Promise.all(
      symbols.map(async (symbol) => [symbol, await getStockQuote(symbol)] as const)
    )
  ) as Record<string, StockQuote | null>;
}

export async function getStockChart(symbol: string, range: string) {
  const { period1, interval } = resolveChartPeriod(range);
  const result = await yahooFinance.chart(symbol, {
    period1,
    interval,
  });

  const quotes = Array.isArray(result.quotes) ? result.quotes : [];

  return quotes
    .filter((entry) => entry.date && typeof entry.close === "number")
    .map(
      (entry): StockChartPoint => ({
        timestamp: entry.date.toISOString(),
        dateLabel: entry.date.toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          year: range === "1d" ? undefined : "2-digit",
        }),
        close: Number(entry.close),
        open: typeof entry.open === "number" ? entry.open : null,
        high: typeof entry.high === "number" ? entry.high : null,
        low: typeof entry.low === "number" ? entry.low : null,
        volume: typeof entry.volume === "number" ? entry.volume : null,
      })
    );
}

export async function getStockDetails(symbol: string) {
  return yahooFinance.quoteSummary(symbol, {
    modules: ["price", "summaryDetail", "summaryProfile", "financialData"],
  });
}

export async function getDividendHistory(symbol: string) {
  const result = await yahooFinance.historical(symbol, {
    events: "dividends",
    period1: "1900-01-01",
  });

  return (result || [])
    .filter((entry) => entry.date && typeof entry.dividends === "number")
    .map(
      (entry): StockDividendItem => ({
        date: entry.date.toISOString(),
        amount: entry.dividends as number,
      })
    );
}

export async function getSplitHistory(symbol: string) {
  const result = await yahooFinance.historical(symbol, {
    events: "split",
    period1: "1900-01-01",
  });

  return (result || [])
    .filter((entry) => entry.date && entry.stockSplits)
    .map(
      (entry): StockSplitItem => {
        const stockSplit =
          typeof entry.stockSplits === "object" && entry.stockSplits
            ? (entry.stockSplits as Record<string, unknown>)
            : null;
        const numerator =
          stockSplit && typeof stockSplit.numerator === "number" ? stockSplit.numerator : null;
        const denominator =
          stockSplit && typeof stockSplit.denominator === "number"
            ? stockSplit.denominator
            : null;

        return {
          date: entry.date.toISOString(),
          numerator,
          denominator,
          splitRatio:
            typeof entry.stockSplits === "string"
              ? entry.stockSplits
              : `${numerator ?? "?"}:${denominator ?? "?"}`,
        };
      }
    );
}

export async function getStockNews(symbol: string) {
  const result = await yahooFinance.search(symbol, {
    quotesCount: 0,
    newsCount: 8,
  });

  return (result.news || []).map(
    (item): StockNewsItem => ({
      id: item.uuid,
      title: item.title,
      publisher: item.publisher,
      link: item.link,
      publishedAt: item.providerPublishTime.toISOString(),
      relatedTickers: Array.isArray(item.relatedTickers) ? item.relatedTickers : [],
    })
  );
}

export async function getStockInsights(symbol: string) {
  return yahooFinance.insights(symbol);
}
