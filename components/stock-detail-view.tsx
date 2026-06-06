"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { ArrowLeft, CircleAlert } from "lucide-react";
import toast from "react-hot-toast";

import type { StockChartPoint, StockDetailData } from "@/lib/stocks.types";

type StockDetailViewProps = {
  currencyCode: string;
  initialData: StockDetailData;
};

const RANGES = [
  { label: "1M", value: "1mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
] as const;

function formatDate(value: string) {
  const isoDate = value.slice(0, 10);
  const [year, month, day] = isoDate.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function StockDetailView({ currencyCode, initialData }: StockDetailViewProps) {
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currencyCode || "INR",
        maximumFractionDigits: 2,
      }),
    [currencyCode]
  );
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("1mo");
  const [chart, setChart] = useState<StockChartPoint[]>(initialData.chart);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadChart() {
      setIsLoadingChart(true);

      try {
        const response = await fetch(
          `/api/stocks/${encodeURIComponent(initialData.symbol)}/chart?range=${encodeURIComponent(range)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const result = (await response.json().catch(() => null)) as
          | { chart?: StockChartPoint[]; message?: string }
          | null;

        if (!response.ok) {
          throw new Error(result?.message || "Unable to load chart.");
        }

        setChart(result?.chart || []);
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error(error instanceof Error ? error.message : "Unable to load chart.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingChart(false);
        }
      }
    }

    void loadChart();

    return () => controller.abort();
  }, [initialData.symbol, range]);

  return (
    <div className="min-h-full bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-[28px] border border-[#dce3ef] bg-white px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#173d7a]" href="/stocks">
                <ArrowLeft className="h-4 w-4" />
                Back to stocks
              </Link>
              <h1 className="text-3xl font-semibold tracking-tight text-[#10203a]">
                {initialData.details.companyName || initialData.symbol}
              </h1>
              <p className="text-sm text-[#5f6f89]">
                {initialData.symbol}
                {initialData.details.exchange ? ` • ${initialData.details.exchange}` : ""}
                {initialData.details.sector ? ` • ${initialData.details.sector}` : ""}
              </p>
            </div>
          </div>
          {initialData.isStale ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#f4d6a0] bg-[#fff8eb] px-4 py-3 text-sm text-[#8a6120]">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>Quote refresh is stale right now. Saved price data is still displayed.</div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailCard label="Current price" value={initialData.quote?.regularMarketPrice == null ? "Unavailable" : formatter.format(initialData.quote.regularMarketPrice)} />
          <DetailCard label="Active quantity" value={initialData.activeHolding ? String(initialData.activeHolding.quantity) : "0"} />
          <DetailCard label="Average price" value={initialData.activeHolding ? formatter.format(initialData.activeHolding.averagePrice) : "N/A"} />
          <DetailCard label="Realized P&L" value={initialData.activeHolding ? formatter.format(initialData.activeHolding.realizedProfit) : formatter.format(0)} />
        </div>

        <section className="rounded-[28px] border border-[#dce4f0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#132842]">Price chart</h2>
              <p className="mt-1 text-sm text-[#6d7d97]">Historical movement for {initialData.symbol}</p>
            </div>
            <div className="flex gap-2">
              {RANGES.map((entry) => (
                <button
                  key={entry.value}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.14em] ${
                    range === entry.value
                      ? "bg-[#173d7a] text-white"
                      : "border border-[#d5dfef] bg-white text-[#5f6f89]"
                  }`}
                  onClick={() => setRange(entry.value)}
                  type="button"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="detailChart" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e8eef7" strokeDasharray="4 4" />
                <XAxis dataKey="dateLabel" tick={{ fill: "#6c7a93", fontSize: 12 }} />
                <YAxis tick={{ fill: "#6c7a93", fontSize: 12 }} tickFormatter={(value) => compactNumber(value)} />
                <Tooltip
                  content={(props) => (
                    <DetailChartTooltip {...props} currencyFormatter={formatter} />
                  )}
                />
                <Area
                  dataKey="close"
                  fill="url(#detailChart)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {isLoadingChart ? <p className="mt-3 text-sm text-[#6d7d97]">Updating chart...</p> : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <InfoPanel title="About">
            <p className="text-sm leading-7 text-[#41526c]">
              {initialData.details.longBusinessSummary || "Business summary is unavailable right now."}
            </p>
            {initialData.details.website ? (
              <a
                className="mt-4 inline-flex text-sm font-medium text-[#173d7a]"
                href={initialData.details.website}
                rel="noreferrer"
                target="_blank"
              >
                Visit company website
              </a>
            ) : null}
          </InfoPanel>

          <InfoPanel title="Fundamentals">
            <Metric label="Market cap" value={initialData.details.marketCap == null ? "Unavailable" : compactNumber(initialData.details.marketCap)} />
            <Metric label="Trailing PE" value={initialData.details.trailingPE == null ? "Unavailable" : initialData.details.trailingPE.toFixed(2)} />
            <Metric label="Forward PE" value={initialData.details.forwardPE == null ? "Unavailable" : initialData.details.forwardPE.toFixed(2)} />
            <Metric label="Dividend yield" value={initialData.details.dividendYield == null ? "Unavailable" : `${(initialData.details.dividendYield * 100).toFixed(2)}%`} />
            <Metric label="52W high" value={initialData.details.fiftyTwoWeekHigh == null ? "Unavailable" : formatter.format(initialData.details.fiftyTwoWeekHigh)} />
            <Metric label="52W low" value={initialData.details.fiftyTwoWeekLow == null ? "Unavailable" : formatter.format(initialData.details.fiftyTwoWeekLow)} />
          </InfoPanel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <InfoPanel title="Transactions">
            {initialData.transactions.length ? (
              <div className="space-y-3">
                {initialData.transactions.slice(0, 8).map((transaction) => (
                  <div key={transaction.id} className="rounded-2xl bg-[#f8fbff] px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#17304f]">{transaction.type}</span>
                      <span className="text-[#6c7a93]">{formatDate(transaction.transactionDate)}</span>
                    </div>
                    <div className="mt-1 text-[#50607a]">
                      {transaction.quantity} @ {formatter.format(transaction.price)}
                    </div>
                    {transaction.realizedProfitForSell != null ? (
                      <div className="mt-1 text-[#17304f]">
                        Realized: {formatter.format(transaction.realizedProfitForSell)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#72829a]">No transactions recorded for this symbol yet.</p>
            )}
          </InfoPanel>

          <InfoPanel title="Dividends">
            {initialData.dividends.length ? (
              <div className="space-y-3">
                {initialData.dividends.slice(0, 8).map((entry) => (
                  <Metric key={entry.date} label={formatDate(entry.date)} value={formatter.format(entry.amount)} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#72829a]">No dividend history available.</p>
            )}
          </InfoPanel>

          <InfoPanel title="Splits">
            {initialData.splits.length ? (
              <div className="space-y-3">
                {initialData.splits.slice(0, 8).map((entry) => (
                  <Metric key={entry.date} label={formatDate(entry.date)} value={entry.splitRatio} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#72829a]">No stock split history available.</p>
            )}
          </InfoPanel>
        </div>

        <InfoPanel title="News">
          {initialData.news.length ? (
            <div className="grid gap-3">
              {initialData.news.map((item) => (
                <a
                  key={item.id}
                  className="rounded-2xl border border-[#e2eaf5] bg-[#f8fbff] px-4 py-3 transition hover:border-[#c7d8ef]"
                  href={item.link}
                  rel="noreferrer"
                  target="_blank"
                >
                  <div className="font-semibold text-[#17304f]">{item.title}</div>
                  <div className="mt-1 text-sm text-[#6d7d97]">
                    {item.publisher} • {formatDateTime(item.publishedAt)}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#72829a]">No recent news available.</p>
          )}
        </InfoPanel>
      </div>
    </div>
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[#dde5f1] bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8aa5]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#132842]">{value}</p>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#dce4f0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <h2 className="mb-4 text-lg font-semibold text-[#132842]">{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[#f8fbff] px-4 py-3 text-sm">
      <span className="text-[#51627d]">{label}</span>
      <span className="font-semibold text-[#17304f]">{value}</span>
    </div>
  );
}

function DetailChartTooltip({
  active,
  payload,
  label,
  currencyFormatter,
}: TooltipContentProps<ValueType, NameType> & { currencyFormatter: Intl.NumberFormat }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#dbe4f0] bg-white px-3 py-2 text-sm text-[#17304f] shadow-lg">
      <div className="font-semibold">{label}</div>
      <div>{currencyFormatter.format(Number(payload[0]?.value || 0))}</div>
    </div>
  );
}
