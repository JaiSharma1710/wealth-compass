import Link from "next/link";

import type { StockHoldingSummary } from "@/lib/stocks.types";

type StocksHoldingsTableProps = {
  currencyCode: string;
  holdings: StockHoldingSummary[];
  title: string;
  subtitle: string;
  emptyMessage: string;
  limit?: number;
  showViewAll?: boolean;
};

export function StocksHoldingsTable({
  currencyCode,
  holdings,
  title,
  subtitle,
  emptyMessage,
  limit,
  showViewAll = false,
}: StocksHoldingsTableProps) {
  const formatter = createCurrencyFormatter(currencyCode);
  const rows = typeof limit === "number" ? holdings.slice(0, limit) : holdings;

  return (
    <section className="rounded-[28px] border border-[#dce4f0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-[#10203a]">{title}</h3>
          <p className="mt-1 text-sm text-[#5f6f89]">{subtitle}</p>
        </div>
        {showViewAll ? (
          <Link
            className="inline-flex items-center rounded-2xl border border-[#d6e0ef] bg-white px-4 py-2 text-sm font-semibold text-[#234067] transition hover:border-[#9cb6dc] hover:bg-[#f8fbff]"
            href="/stocks/holdings"
          >
            View All
          </Link>
        ) : null}
      </div>

      {rows.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8aa5]">
                <th className="px-3">Stock</th>
                <th className="px-3">Qty</th>
                <th className="px-3">Avg</th>
                <th className="px-3">Current</th>
                <th className="px-3">P&amp;L</th>
                <th className="px-3">Today</th>
                <th className="px-3">Allocation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((holding) => (
                <tr
                  key={holding.id}
                  className="rounded-2xl bg-[#f8fbff] text-sm text-[#143155] shadow-[inset_0_0_0_1px_#e4edf7]"
                >
                  <td className="rounded-l-2xl px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <Link
                        className="font-semibold text-[#173d7a] hover:text-[#0f2d5c]"
                        href={`/stocks/${encodeURIComponent(holding.symbol)}`}
                      >
                        {displaySymbol(holding.symbol, holding.shortName)}
                      </Link>
                      <span className="text-xs text-[#6c7a93]">{holding.companyName}</span>
                      {holding.isStale ? (
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#b27712]">
                          Stale quote
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">{holding.quantity}</td>
                  <td className="px-3 py-3">{formatter.format(holding.averagePrice)}</td>
                  <td className="px-3 py-3">
                    {holding.currentPrice == null ? "Unavailable" : formatter.format(holding.currentPrice)}
                  </td>
                  <td className="px-3 py-3">
                    <ValuePill
                      formatter={formatter}
                      percent={holding.unrealizedProfitPercent}
                      value={holding.unrealizedProfit}
                    />
                  </td>
                  <td className="px-3 py-3">
                    {holding.todayPnL == null ? (
                      <span className="text-xs text-[#8a97ad]">Unavailable</span>
                    ) : (
                      <ValuePill
                        formatter={formatter}
                        percent={holding.todayPnLPercent}
                        value={holding.todayPnL}
                      />
                    )}
                  </td>
                  <td className="rounded-r-2xl px-3 py-3">
                    {formatPercent(holding.allocationPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 rounded-[24px] border border-dashed border-[#d6e0ef] bg-[#f8fbff] px-5 py-10 text-center text-sm text-[#6f7f97]">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function ValuePill({
  value,
  percent,
  formatter,
}: {
  value: number;
  percent: number | null;
  formatter: Intl.NumberFormat;
}) {
  const tone = value >= 0 ? "bg-[#eaf7ef] text-[#0f7a56]" : "bg-[#fff1f1] text-[#b23434]";

  return (
    <div className={`inline-flex min-w-[110px] flex-col rounded-2xl px-3 py-2 text-xs font-medium ${tone}`}>
      <span>{value >= 0 ? `+${formatter.format(value)}` : `(${formatter.format(Math.abs(value))})`}</span>
      <span className="mt-1 text-[11px] text-current/80">{formatPercent(percent)}</span>
    </div>
  );
}

function formatPercent(value: number | null) {
  if (value == null) {
    return "Unavailable";
  }

  return value >= 0 ? `+${value.toFixed(2)}%` : `(${Math.abs(value).toFixed(2)}%)`;
}

function displaySymbol(symbol: string, shortName?: string | null) {
  if (shortName) {
    return shortName;
  }

  return symbol.includes(".") ? symbol.split(".")[0] || symbol : symbol;
}

function createCurrencyFormatter(currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode || "USD",
      maximumFractionDigits: 2,
    });
  } catch {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
    });
  }
}
