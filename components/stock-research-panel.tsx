"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Microscope, Sparkles, XCircle } from "lucide-react";
import toast from "react-hot-toast";

import { ColumnChart } from "@/components/ui/charts";
import { Badge, Button, Card, CardHeader, EmptyState, ProgressBar } from "@/components/ui/kit";
import { formatDateTime } from "@/lib/format";
import type { StockCategory, StockRating, StockScorecard } from "@/lib/stock-model/types";
import { cn } from "@/lib/utils";

export type FinancialRow = { period: string; revenue: number | null; netProfit: number | null };

export type AnalysisReportView = {
  analysis: {
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
  provider: string;
  model: string;
  generatedAt: string;
};

export const RATING_STYLE: Record<StockRating, { label: string; tone: "gain" | "brand" | "neutral" | "warn" | "loss" }> = {
  strong: { label: "Strong", tone: "gain" },
  good: { label: "Good", tone: "brand" },
  average: { label: "Average", tone: "neutral" },
  weak: { label: "Weak", tone: "warn" },
  avoid: { label: "Avoid", tone: "loss" },
};

export const CATEGORY_COPY: Record<StockCategory, { label: string; description: string }> = {
  compounder: { label: "Compounder", description: "Coffee-can style: high returns on capital with steady growth and a sound balance sheet." },
  quality_premium: { label: "Quality at a premium", description: "An excellent business, but the price already reflects much of it." },
  value_opportunity: { label: "Value opportunity", description: "A decent business trading at an undemanding valuation." },
  turnaround: { label: "Turnaround", description: "Returns are weak but financial health is improving (Piotroski)." },
  value_trap: { label: "Possible value trap", description: "Looks cheap, but quality or cash generation is poor." },
  weak: { label: "Weak fundamentals", description: "Fragile profitability or balance sheet." },
  average: { label: "Average", description: "Neither a standout nor a red flag." },
};

const VERDICT_STYLE = {
  add: { label: "Add", tone: "gain" },
  hold: { label: "Hold", tone: "brand" },
  watch: { label: "Watch", tone: "neutral" },
  trim: { label: "Trim", tone: "warn" },
  exit: { label: "Exit", tone: "loss" },
} as const;

function scoreTone(score: number | null) {
  if (score == null) return "brand" as const;
  return score >= 70 ? "gain" : score >= 45 ? "warn" : "loss";
}

function formatValue(value: number | null, unit: string) {
  if (value == null) return "n/a";
  if (unit === "pct") return `${(value * 100).toFixed(1)}%`;
  if (unit === "ratio") return `${Math.round(value * 100)}%`;
  if (unit === "x") return `${value.toFixed(1)}x`;
  return String(Math.round(value * 10) / 10);
}

export function StockResearchPanel({
  symbol,
  scorecard,
  financials,
  initialReports,
  signal,
  error,
}: {
  symbol: string;
  scorecard: StockScorecard | null;
  financials: FinancialRow[];
  initialReports: AnalysisReportView[];
  signal: { label: string; reason: string } | null;
  error: string | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [reports, setReports] = useState(initialReports);
  const [running, setRunning] = useState(false);
  const report = reports.at(-1) || null;

  async function analyze() {
    setRunning(true);

    try {
      const response = await fetch(`/api/research/${encodeURIComponent(symbol)}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: reports.length > 0 }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.report) throw new Error(result?.message || "Analysis failed.");

      setReports([result.report]);
    } catch (analysisError) {
      toast.error(analysisError instanceof Error ? analysisError.message : "Analysis failed.");
    } finally {
      setRunning(false);
    }
  }

  if (!scorecard) {
    return (
      <Card className="mt-4">
        <CardHeader title="Fundamental research" />
        <EmptyState icon={Microscope} title="Research unavailable" message={error || "Not enough financial history for this company yet."} className="py-6" />
      </Card>
    );
  }

  const rating = RATING_STYLE[scorecard.rating];
  const category = CATEGORY_COPY[scorecard.category];

  return (
    <>
      <Card className="mt-4">
        <CardHeader
          title="Fundamental scorecard"
          subtitle={`Wealth Compass model · FY to ${scorecard.fiscalYear?.slice(0, 7)} · ${scorecard.yearsOfData} years of data`}
          action={<Badge tone={scorecard.confidence === "high" ? "gain" : "warn"}>{scorecard.confidence} confidence</Badge>}
        />
        <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-4">
            <ScoreDial score={scorecard.score} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={rating.tone}>{rating.label}</Badge>
                <Badge>{category.label}</Badge>
              </div>
              <p className="mt-1.5 max-w-xs text-sm text-ink-2">{category.description}</p>
              {signal ? (
                <p className="mt-2 text-sm">
                  <span className="font-semibold text-ink">{signal.label}</span> <span className="text-ink-3">· {signal.reason}</span>
                </p>
              ) : null}
            </div>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {scorecard.pillars.filter((pillar) => pillar.metrics.length).map((pillar) => (
              <li key={pillar.pillar}>
                <button
                  type="button"
                  onClick={() => setOpen(open === pillar.pillar ? null : pillar.pillar)}
                  className="w-full rounded-xl px-2 py-1.5 text-left transition hover:bg-surface-2"
                  aria-expanded={open === pillar.pillar}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-ink">{pillar.label}</span>
                    <span className="flex items-center gap-1 tabular font-semibold text-ink">
                      {pillar.score ?? "—"}
                      <ChevronDown className={cn("size-3.5 text-ink-3 transition", open === pillar.pillar && "rotate-180")} />
                    </span>
                  </div>
                  <ProgressBar value={pillar.score ?? 0} tone={scoreTone(pillar.score)} label={pillar.label} />
                </button>
                {open === pillar.pillar ? (
                  <ul className="mt-1 space-y-1.5 rounded-xl bg-surface-2 p-3">
                    {pillar.metrics.map((metric) => (
                      <li key={metric.key} className="text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="text-ink-2">{metric.label}</span>
                          <span className="tabular font-medium text-ink">
                            {formatValue(metric.value, metric.unit)}
                            <span className="ml-1.5 text-ink-3">({metric.score ?? "—"})</span>
                          </span>
                        </div>
                        <p className="text-ink-3">{metric.benchmark}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 grid gap-4 border-t border-line pt-4 md:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-2">Strengths</p>
            <ul className="space-y-1.5">
              {(scorecard.strengths.length ? scorecard.strengths : ["No standout metrics."]).map((item) => (
                <li key={item} className="flex gap-1.5 text-xs text-ink-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-gain" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-2">Concerns</p>
            <ul className="space-y-1.5">
              {(scorecard.concerns.length ? scorecard.concerns : ["No red flags in the numbers."]).map((item) => (
                <li key={item} className="flex gap-1.5 text-xs text-ink-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2 text-xs">
            <p className="font-semibold text-ink-2">Checklists</p>
            <p className="flex items-start gap-1.5 text-ink-2">
              {scorecard.coffeeCan.passed ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-gain" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-ink-3" />}
              <span>
                Coffee Can: revenue +10% in {scorecard.coffeeCan.revenueGrowthYears} years, {scorecard.isFinancial ? "ROE" : "ROCE"} 15%+ in {scorecard.coffeeCan.roceYears}.{" "}
                <span className="text-ink-3">{scorecard.coffeeCan.note}</span>
              </span>
            </p>
            {scorecard.piotroski != null ? (
              <p className="text-ink-2">
                Piotroski F-score <span className="font-semibold text-ink">{scorecard.piotroski}/9</span>{" "}
                <span className="text-ink-3">(7+ healthy, 3 or less weak)</span>
              </p>
            ) : null}
          </div>
        </div>

        {financials.length >= 2 ? (
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold text-ink-2">Revenue and net profit (₹ crore)</p>
            <ColumnChart
              height={190}
              xKey="period"
              xFormatter={(value) => `FY${String(value).slice(2, 4)}`}
              valueFormatter={(value) => `₹${Math.round(value).toLocaleString("en-IN")} Cr`}
              data={financials.map((row) => ({ period: row.period, revenue: row.revenue ?? 0, netProfit: row.netProfit ?? 0 }))}
              series={[
                { key: "revenue", label: "Revenue", color: "var(--wc-asset-stocks)" },
                { key: "netProfit", label: "Net profit", color: "var(--wc-asset-cash)" },
              ]}
            />
          </div>
        ) : null}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="AI research note"
          subtitle="Reads the scorecard, 4 years of financials, recent quarters, news and your position"
          action={
            <Button size="sm" variant="primary" icon={Sparkles} loading={running} onClick={() => void analyze()}>
              {report ? "Re-analyse" : "Analyse with AI"}
            </Button>
          }
        />
        {report ? (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={VERDICT_STYLE[report.analysis.verdict].tone}>{VERDICT_STYLE[report.analysis.verdict].label}</Badge>
              <Badge>{report.analysis.conviction} conviction</Badge>
              <span className="text-xs text-ink-3">
                {report.model} · {formatDateTime(report.generatedAt)}
              </span>
            </div>
            <h4 className="mt-2 text-base font-semibold text-ink">{report.analysis.headline}</h4>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{report.analysis.summary}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Paragraph title="Business" text={report.analysis.business} />
              <Paragraph title="Financial health" text={report.analysis.financialHealth} />
              <Paragraph title="Valuation" text={report.analysis.valuation} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Bullets title="What the news says" items={report.analysis.newsTakeaways} />
              <Bullets title="Catalysts" items={report.analysis.catalysts} />
              <Bullets title="Risks" items={report.analysis.risks} />
              <Bullets title="Watch next" items={report.analysis.whatToWatch} />
            </div>
            <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
              <span className="font-semibold text-ink">{report.analysis.agreesWithModel ? "Agrees with the model" : "Differs from the model"}:</span>{" "}
              {report.analysis.modelComment}
            </p>
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No AI note yet"
            message="Tap Analyse with AI for a research note on this company, its financials and recent news."
            className="py-6"
          />
        )}
        <p className="mt-4 text-[0.7rem] leading-relaxed text-ink-3">
          Scores come from a rules-based model backtested on 100 NSE stocks; AI notes are generated from that data and can be wrong. Educational research, not a recommendation from a SEBI-registered adviser.
        </p>
      </Card>
    </>
  );
}

function Paragraph({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-ink-2">{title}</p>
      <p className="text-sm leading-relaxed text-ink-2">{text}</p>
    </div>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-ink-2">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5 text-xs text-ink-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-3" /> {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScoreDial({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const tone = scoreTone(score);

  return (
    <div className={cn("relative shrink-0", size === "md" ? "size-24" : "size-12")}>
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--wc-surface-3)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={`var(--wc-${tone})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center tabular font-semibold text-ink", size === "md" ? "text-2xl" : "text-sm")}>
        {score}
      </span>
    </div>
  );
}
