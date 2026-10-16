"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, LineChart, Minus, Newspaper, Plus } from "lucide-react";

import { StockResearchPanel, type AnalysisReportView, type FinancialRow } from "@/components/stock-research-panel";
import { displaySymbol, StockBuySheet, StockSellSheet } from "@/components/stocks-trade-sheets";
import { TrendChart } from "@/components/ui/charts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Delta,
  EmptyState,
  MetaRow,
  Page,
  Segmented,
  Skeleton,
} from "@/components/ui/kit";
import { formatDate, formatMoney, formatNumber, formatPercent, formatRelativeTime } from "@/lib/format";
import type { StockScorecard } from "@/lib/stock-model/types";
import type { StockChartPoint, StockDetailData, StockNewsItem } from "@/lib/stocks.types";

const RANGES = [
  { value: "1mo", label: "1M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
] as const;

type Range = (typeof RANGES)[number]["value"];

export function StockDetailView({
  initialData,
  currencyCode,
  research,
}: {
  initialData: StockDetailData;
  currencyCode: string;
  research: {
    scorecard: StockScorecard | null;
    financials: FinancialRow[];
    reports: AnalysisReportView[];
    signal: { label: string; reason: string } | null;
    error: string | null;
  };
}) {
  const router = useRouter();
  const currency = currencyCode;
  const data = initialData;
  const holding = data.activeHolding;
  const [range, setRange] = useState<Range>("6mo");
  const [chart, setChart] = useState<{ range: Range; points: StockChartPoint[]; source: string } | null>(null);
  const [news, setNews] = useState<StockNewsItem[] | null>(null);
  const [sheet, setSheet] = useState<"buy" | "sell" | null>(null);
  const name = data.details.companyName || holding?.companyName || displaySymbol(data.symbol);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/stocks/${encodeURIComponent(data.symbol)}/chart?range=${range}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { chart: [], source: "none" }))
      .then((result) => setChart({ range, points: result.chart || [], source: result.source || "none" }))
      .catch(() => {
        if (!controller.signal.aborted) setChart({ range, points: [], source: "none" });
      });

    return () => controller.abort();
  }, [data.symbol, range]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/stocks/${encodeURIComponent(data.symbol)}/news`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { news: [] }))
      .then((result) => setNews(result.news || []))
      .catch(() => {
        if (!controller.signal.aborted) setNews([]);
      });

    return () => controller.abort();
  }, [data.symbol]);

  const loadingChart = !chart || chart.range !== range;
  const points = (chart?.points || []).map((point) => ({ date: point.timestamp, close: point.close }));
  const periodChange =
    points.length > 1
      ? {
          value: points[points.length - 1].close - points[0].close,
          percent: ((points[points.length - 1].close - points[0].close) / points[0].close) * 100,
        }
      : null;

  return (
    <Page>
      <Link href="/stocks" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-3 transition hover:text-ink">
        <ArrowLeft className="size-4" /> Stocks
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-ink">{displaySymbol(data.symbol)}</h2>
              {data.details.exchange ? <Badge>{data.details.exchange}</Badge> : null}
            </div>
            <p className="truncate text-sm text-ink-3">{name}</p>
            <p className="tabular mt-3 text-3xl font-semibold text-ink">
              {formatMoney(holding?.currentPrice ?? data.quote?.regularMarketPrice ?? null, { currency, decimals: 2 })}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {holding?.todayPnLPercent != null ? (
                <Delta percent={holding.todayPnLPercent} suffix="1D" />
              ) : null}
              <span className="text-xs text-ink-3">
                {data.lastUpdatedAt ? `Synced ${formatRelativeTime(data.lastUpdatedAt)}` : "Not synced yet"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" icon={Plus} onClick={() => setSheet("buy")}>
              Buy more
            </Button>
            <Button icon={Minus} disabled={!holding} onClick={() => setSheet("sell")}>
              Sell
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Price"
            subtitle={
              chart?.source === "synced"
                ? "Prices synced into Wealth Compass"
                : periodChange
                  ? (
                      <>
                        {RANGES.find((entry) => entry.value === range)?.label} change{" "}
                        <Delta value={periodChange.value} percent={periodChange.percent} size="xs" currency={currency} />
                      </>
                    )
                  : "Market price history"
            }
            action={
              <Segmented size="xs" value={range} onChange={setRange} options={RANGES} ariaLabel="Chart range" />
            }
          />
          {loadingChart ? (
            <Skeleton className="h-60 w-full" />
          ) : points.length > 1 ? (
            <TrendChart
              data={points}
              xKey="date"
              height={240}
              currency={currency}
              valueFormatter={(value) => formatMoney(value, { currency, decimals: 2 })}
              series={[{ key: "close", label: "Price", color: "var(--wc-asset-stocks)" }]}
            />
          ) : (
            <EmptyState
              icon={LineChart}
              title="Price history unavailable"
              message="Market data couldn't be loaded right now. It fills in as daily prices sync."
              className="py-12"
            />
          )}
          {holding && points.length > 1 ? (
            <p className="mt-2 text-xs text-ink-3">
              Your average buy price is {formatMoney(holding.averagePrice, { currency, decimals: 2 })} —{" "}
              {holding.currentPrice != null && holding.currentPrice >= holding.averagePrice ? "the stock trades above it." : "the stock trades below it."}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Your position" />
          {holding ? (
            <div className="divide-y divide-line">
              <MetaRow label="Shares" value={formatNumber(holding.quantity, 0)} />
              <MetaRow label="Average price" value={formatMoney(holding.averagePrice, { currency, decimals: 2 })} />
              <MetaRow label="Invested" value={formatMoney(holding.investedAmount, { currency })} />
              <MetaRow label="Current value" value={formatMoney(holding.currentValue, { currency })} />
              <MetaRow
                label="Returns"
                value={<Delta value={holding.unrealizedProfit} percent={holding.unrealizedProfitPercent} size="sm" currency={currency} />}
              />
              <MetaRow
                label="1D change"
                value={<Delta value={holding.todayPnL} percent={holding.todayPnLPercent} size="sm" currency={currency} />}
              />
              <MetaRow label="Portfolio weight" value={formatPercent(holding.allocationPercent, { decimals: 1 })} />
              <MetaRow label="Holding since" value={formatDate(holding.openedAt)} />
            </div>
          ) : (
            <EmptyState title="Not currently held" message="You've sold all shares of this stock." className="py-6" />
          )}
        </Card>
      </div>

      <StockResearchPanel
        symbol={data.symbol}
        scorecard={research.scorecard}
        financials={research.financials}
        initialReports={research.reports}
        signal={research.signal}
        error={research.error}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your trades" subtitle={`${data.transactions.length} transaction${data.transactions.length === 1 ? "" : "s"}`} />
          {data.transactions.length ? (
            <ul className="divide-y divide-line">
              {data.transactions.map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Badge tone={transaction.type === "BUY" ? "brand" : "warn"}>{transaction.type}</Badge>
                    <div className="min-w-0">
                      <p className="tabular text-sm text-ink">
                        {formatNumber(transaction.quantity, 0)} @ {formatMoney(transaction.price, { currency, decimals: 2 })}
                      </p>
                      <p className="text-xs text-ink-3">{formatDate(transaction.transactionDate)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-sm font-medium text-ink">
                      {formatMoney(
                        transaction.type === "BUY"
                          ? transaction.buyNetAmount ?? transaction.quantity * transaction.price
                          : transaction.sellNetAmount ?? transaction.quantity * transaction.price,
                        { currency }
                      )}
                    </p>
                    {transaction.type === "SELL" && transaction.realizedProfitForSell != null ? (
                      <Delta value={transaction.realizedProfitForSell} size="xs" currency={currency} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No trades" className="py-6" />
          )}
        </Card>

        <Card>
          <CardHeader title="News" subtitle="Latest headlines" />
          {news === null ? (
            <div className="space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : news.length ? (
            <ul className="divide-y divide-line">
              {news.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="-mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-2.5 transition hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm text-ink">{item.title}</span>
                      <span className="text-xs text-ink-3">
                        {item.publisher} · {formatRelativeTime(item.publishedAt)}
                      </span>
                    </span>
                    <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Newspaper} title="No news right now" className="py-6" />
          )}
        </Card>
      </div>

      <StockBuySheet
        open={sheet === "buy"}
        onClose={() => setSheet(null)}
        onSaved={() => router.refresh()}
        currency={currency}
        preset={
          holding
            ? {
                symbol: holding.symbol,
                exchange: holding.exchange,
                companyName: holding.companyName,
                shortName: holding.shortName,
                quoteType: "EQUITY",
                sector: holding.sector,
                industry: holding.industry,
              }
            : null
        }
      />
      {sheet === "sell" && holding ? (
        <StockSellSheet
          open
          onClose={() => setSheet(null)}
          onSaved={() => router.refresh()}
          holdings={[holding]}
          currency={currency}
          initialSymbol={holding.symbol}
        />
      ) : null}
    </Page>
  );
}
