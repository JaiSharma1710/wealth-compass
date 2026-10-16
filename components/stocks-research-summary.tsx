"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Microscope } from "lucide-react";

import { CATEGORY_COPY, RATING_STYLE, ScoreDial } from "@/components/stock-research-panel";
import { displaySymbol } from "@/components/stocks-trade-sheets";
import { Badge, Card, CardHeader, Skeleton } from "@/components/ui/kit";
import type { StockRating } from "@/lib/stock-model/types";
import { formatPercent } from "@/lib/format";

type Research = {
  modelVersion: string;
  portfolioScore: number | null;
  ratingCounts: Record<StockRating, number>;
  holdings: Array<{
    symbol: string;
    weightPercent: number;
    returnsPercent: number;
    scorecard: { score: number; rating: StockRating; category: keyof typeof CATEGORY_COPY } | null;
    signal: { label: string; reason: string } | null;
    error: string | null;
  }>;
};

/** Model scorecard for every holding: quality of the portfolio at a glance. */
export function StocksResearchSummary() {
  const [research, setResearch] = useState<Research | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/research", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((result) => setResearch(result.research))
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, []);

  if (failed) return null;

  return (
    <Card className="mt-4">
      <CardHeader
        title="Portfolio quality"
        subtitle="Each holding scored on quality, growth, balance sheet, earnings quality, valuation and momentum"
        action={research ? <span className="text-xs text-ink-3">{research.modelVersion}</span> : null}
      />
      {!research ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-4 lg:flex-col lg:items-start">
            {research.portfolioScore != null ? <ScoreDial score={research.portfolioScore} /> : null}
            <div className="flex flex-wrap gap-1.5 lg:max-w-[12rem]">
              {(Object.keys(RATING_STYLE) as StockRating[])
                .filter((rating) => research.ratingCounts[rating])
                .map((rating) => (
                  <Badge key={rating} tone={RATING_STYLE[rating].tone}>
                    {research.ratingCounts[rating]} {RATING_STYLE[rating].label.toLowerCase()}
                  </Badge>
                ))}
            </div>
          </div>
          <ul className="divide-y divide-line">
            {research.holdings.map((holding) => (
              <li key={holding.symbol}>
                <Link href={`/stocks/${encodeURIComponent(holding.symbol)}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-surface-2">
                  {holding.scorecard ? <ScoreDial score={holding.scorecard.score} size="sm" /> : <span className="flex size-12 items-center justify-center text-ink-3"><Microscope className="size-4" /></span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-ink">{displaySymbol(holding.symbol)}</span>
                      {holding.scorecard ? (
                        <>
                          <Badge tone={RATING_STYLE[holding.scorecard.rating].tone}>{RATING_STYLE[holding.scorecard.rating].label}</Badge>
                          <span className="hidden text-xs text-ink-3 sm:inline">{CATEGORY_COPY[holding.scorecard.category].label}</span>
                        </>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-ink-3">{holding.signal ? holding.signal.reason : holding.error}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {holding.signal ? <p className="text-xs font-semibold text-ink">{holding.signal.label}</p> : null}
                    <p className="tabular text-xs text-ink-3">{formatPercent(holding.weightPercent, { decimals: 1 })} of stocks</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
