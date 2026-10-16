import "server-only";

import { Types } from "mongoose";

import { getTodayDateKey } from "@/lib/daily-values";
import { StockAnalysisModel } from "@/lib/models/stock-research";
import { connectToDatabase } from "@/lib/mongodb";
import { generateStructured } from "@/lib/services/gemini.service";
import { getNewsForStock } from "@/lib/stock-news";
import { formatMetric } from "@/lib/stock-model/score";
import type { FinancialPeriod } from "@/lib/stock-model/types";
import { MODEL_VERSION } from "@/lib/stock-model/weights";
import { getScorecard, positionSignal } from "@/lib/stock-research";
import { getStockDashboard } from "@/lib/stocks";

export type AnalysisProvider = "gemini";

export type StockAnalysis = {
  verdict: "add" | "hold" | "trim" | "exit" | "watch";
  conviction: "low" | "medium" | "high";
  headline: string;
  summary: string;
  business: string;
  financialHealth: string;
  valuation: string;
  newsTakeaways: string[];
  risks: string[];
  catalysts: string[];
  whatToWatch: string[];
  agreesWithModel: boolean;
  modelComment: string;
};

export type StockAnalysisReport = {
  analysis: StockAnalysis;
  provider: AnalysisProvider;
  model: string;
  generatedAt: string;
};

const COOLDOWN_MS = 10 * 60 * 1000;
const CRORE = 1e7;

const SYSTEM_PROMPT = `You are an equity research analyst for Indian listed companies, writing for a retail investor who already owns the stock.
Ground every statement in the supplied data (financials in ₹ crore, scorecard, news headlines, the investor's position). Never invent numbers, targets or events not in the data; if data is missing, say so.
Framework (the scorecard already applies it): quality = ROCE/ROE and their consistency (Coffee Can: ROCE >= 15% and revenue growth >= 10% every year; Buffett: durable high returns, low debt, cash-backed profits); growth consistency (Fisher, Lynch); balance-sheet strength (Graham, Piotroski); earnings quality (cash conversion, accruals); valuation (earnings yield, FCF yield, P/E vs growth); momentum as a minor input.
The deterministic model and position signal are provided; say whether you agree and why (agreesWithModel + modelComment).
verdict is one of add, hold, trim, exit, watch — for THIS investor's position (consider their weight and gain/loss). conviction: low, medium or high.
Use news only for what it implies about the business (results, guidance, orders, regulation, management); ignore generic market chatter.
Keep paragraphs to 2-3 sentences; list items short. This is educational research, not a SEBI-registered recommendation. No markdown.`;

const STRING = { type: "STRING" };
const LIST = { type: "ARRAY", items: STRING };
const SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["add", "hold", "trim", "exit", "watch"] },
    conviction: { type: "STRING", enum: ["low", "medium", "high"] },
    headline: STRING,
    summary: STRING,
    business: STRING,
    financialHealth: STRING,
    valuation: STRING,
    newsTakeaways: LIST,
    risks: LIST,
    catalysts: LIST,
    whatToWatch: LIST,
    agreesWithModel: { type: "BOOLEAN" },
    modelComment: STRING,
  },
  required: ["verdict", "conviction", "headline", "summary", "business", "financialHealth", "valuation", "newsTakeaways", "risks", "catalysts", "whatToWatch", "agreesWithModel", "modelComment"],
};

function crore(value: number | null | undefined) {
  return value == null ? null : Math.round((value / CRORE) * 10) / 10;
}

function financialTable(periods: FinancialPeriod[]) {
  return periods.slice(-4).map((period) => ({
    period: period.date,
    revenue: crore(period.totalRevenue),
    ebit: crore(period.EBIT ?? period.operatingIncome),
    netProfit: crore(period.netIncome),
    operatingCashFlow: crore(period.operatingCashFlow),
    freeCashFlow: crore(period.freeCashFlow),
    totalDebt: crore(period.totalDebt),
    equity: crore(period.stockholdersEquity),
    eps: period.dilutedEPS ?? null,
  }));
}

function normalize(raw: Partial<StockAnalysis>): StockAnalysis {
  const list = (value: unknown) => (Array.isArray(value) ? value.map(String).slice(0, 6) : []);
  const verdicts = ["add", "hold", "trim", "exit", "watch"] as const;
  return {
    verdict: verdicts.includes(raw.verdict as StockAnalysis["verdict"]) ? (raw.verdict as StockAnalysis["verdict"]) : "watch",
    conviction: ["low", "medium", "high"].includes(String(raw.conviction)) ? (raw.conviction as StockAnalysis["conviction"]) : "low",
    headline: String(raw.headline || ""),
    summary: String(raw.summary || ""),
    business: String(raw.business || ""),
    financialHealth: String(raw.financialHealth || ""),
    valuation: String(raw.valuation || ""),
    newsTakeaways: list(raw.newsTakeaways),
    risks: list(raw.risks),
    catalysts: list(raw.catalysts),
    whatToWatch: list(raw.whatToWatch),
    agreesWithModel: Boolean(raw.agreesWithModel),
    modelComment: String(raw.modelComment || ""),
  };
}

export async function getCachedStockAnalysis(userId: string, symbol: string) {
  await connectToDatabase();
  const docs = await StockAnalysisModel.find({ userId: new Types.ObjectId(userId), symbol: symbol.toUpperCase(), date: getTodayDateKey() }).lean();
  return docs.map((doc) => ({
    analysis: doc.analysis as StockAnalysis,
    provider: doc.provider as AnalysisProvider,
    model: doc.model || "",
    generatedAt: new Date(doc.generatedAt).toISOString(),
  })) satisfies StockAnalysisReport[];
}

export async function analyzeStock(
  userId: string,
  symbol: string,
  options: { force?: boolean } = {}
): Promise<StockAnalysisReport> {
  const provider: AnalysisProvider = "gemini";
  await connectToDatabase();

  const key = symbol.toUpperCase();
  const today = getTodayDateKey();
  const userObjectId = new Types.ObjectId(userId);
  const existing = await StockAnalysisModel.findOne({ userId: userObjectId, symbol: key, provider, date: today }).lean();

  if (existing && (!options.force || Date.now() - new Date(existing.generatedAt).getTime() < COOLDOWN_MS)) {
    return { analysis: existing.analysis as StockAnalysis, provider, model: existing.model || "", generatedAt: new Date(existing.generatedAt).toISOString() };
  }

  const [{ fundamentals, scorecard }, dashboard] = await Promise.all([getScorecard(key), getStockDashboard(userId)]);
  const holding = dashboard.holdings.find((entry) => entry.symbol === key) || null;
  const news = await getNewsForStock(key, fundamentals.name).catch(() => []);
  const position = holding
    ? {
        shares: holding.quantity,
        averagePrice: holding.averagePrice,
        currentPrice: holding.currentPrice,
        returnsPercent: holding.unrealizedProfitPercent,
        weightInStocksPercent: dashboard.totalCurrentValue ? Math.round((holding.currentValue / dashboard.totalCurrentValue) * 1000) / 10 : null,
      }
    : null;
  const payload = {
    company: { symbol: key, name: fundamentals.name, sector: fundamentals.sector, industry: fundamentals.industry },
    position,
    model: scorecard && {
      version: MODEL_VERSION,
      score: scorecard.score,
      rating: scorecard.rating,
      category: scorecard.category,
      pillars: scorecard.pillars.map((pillar) => ({
        pillar: pillar.label,
        score: pillar.score,
        metrics: pillar.metrics.map((metric) => `${metric.label}: ${formatMetric(metric)} (score ${metric.score ?? "n/a"})`),
      })),
      coffeeCan: scorecard.coffeeCan,
      piotroski: scorecard.piotroski,
      signal: position ? positionSignal(scorecard, { weightPercent: position.weightInStocksPercent || 0, returnsPercent: position.returnsPercent }) : null,
    },
    annualFinancialsCrore: financialTable(fundamentals.annual),
    recentQuartersCrore: financialTable(fundamentals.quarterly),
    news: news.slice(0, 12).map((item) => `${item.publishedAt.slice(0, 10)} · ${item.source}: ${item.title}`),
  };
  const prompt = `Research this holding:\n${JSON.stringify(payload)}`;
  const result = await generateStructured<StockAnalysis>({ system: SYSTEM_PROMPT, prompt, schema: SCHEMA, temperature: 0.3 });
  const analysis = normalize(result.data);
  const generatedAt = new Date();

  await StockAnalysisModel.updateOne(
    { userId: userObjectId, symbol: key, provider, date: today },
    { $set: { userId: userObjectId, symbol: key, provider, date: today, analysis, model: result.model, generatedAt } },
    { upsert: true }
  );

  return { analysis, provider, model: result.model, generatedAt: generatedAt.toISOString() };
}
