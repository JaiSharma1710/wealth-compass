import Link from "next/link";

import type { MutualFundHoldingSummary } from "@/lib/mutual-funds.types";

type MutualFundsHoldingsTableProps = {
  currencyCode: string;
  holdings: MutualFundHoldingSummary[];
  title: string;
  subtitle: string;
  emptyMessage: string;
  limit?: number;
  showViewAll?: boolean;
};

export function MutualFundsHoldingsTable({
  currencyCode,
  holdings,
  title,
  subtitle,
  emptyMessage,
  limit,
  showViewAll = false,
}: MutualFundsHoldingsTableProps) {
  const formatter = createCurrencyFormatter(currencyCode);
  const rows = typeof limit === "number" ? holdings.slice(0, limit) : holdings;

  return (
    <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-neutral-950">{title}</h3>
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        </div>
        {showViewAll ? (
          <Link
            className="inline-flex items-center rounded-[1rem] border border-[#dbe2ee] px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
            href="/mutual-funds/holdings"
          >
            View All
          </Link>
        ) : null}
      </div>

      <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#eef2f7]">
        <table className="min-w-full text-left">
          <thead className="bg-[#fafaf8] text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Fund</th>
              <th className="px-4 py-3">Avg NAV</th>
              <th className="px-4 py-3">Current NAV</th>
              <th className="px-4 py-3">Units</th>
              <th className="px-4 py-3">Invested</th>
              <th className="px-4 py-3">Current Value</th>
              <th className="px-4 py-3">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f7] bg-white">
            {rows.length ? (
              rows.map((holding) => (
                <tr key={holding.schemeCode} className="align-top text-sm text-neutral-700">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-950">{holding.schemeName}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Allocation {holding.allocationPct.toFixed(1)}%
                    </p>
                  </td>
                  <td className="px-4 py-3">{formatter.format(holding.averageNav)}</td>
                  <td className="px-4 py-3">{formatter.format(holding.currentNav)}</td>
                  <td className="px-4 py-3">{holding.units.toFixed(2)}</td>
                  <td className="px-4 py-3">{formatter.format(holding.investedAmount)}</td>
                  <td className="px-4 py-3 font-medium text-neutral-950">
                    {formatter.format(holding.currentValue)}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      holding.profitLossAmount >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    <span className="whitespace-nowrap">
                      {holding.profitLossAmount >= 0 ? "+" : "-"}
                      {formatter.format(Math.abs(holding.profitLossAmount))}
                    </span>
                    <p className="mt-1 text-xs font-medium text-current/80">
                      {holding.profitLossAmount >= 0 ? "+" : ""}
                      {holding.profitLossPct.toFixed(1)}%
                    </p>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-sm text-neutral-500" colSpan={7}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
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
