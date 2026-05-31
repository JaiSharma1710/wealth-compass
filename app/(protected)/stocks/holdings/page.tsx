import Link from "next/link";

import { StocksHoldingsTable } from "@/components/stocks-holdings-table";
import { requireCurrentUser } from "@/lib/auth";
import { getStockDashboard } from "@/lib/stocks";

export default async function StockHoldingsPage() {
  const user = await requireCurrentUser();
  const dashboard = await getStockDashboard(user.id);

  return (
    <div className="min-h-full bg-[#f5f7fb] p-4 sm:p-6">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-[#dce4f0] bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#5f6f89]">Stocks</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#10203a]">
              All Holdings
            </h1>
            <p className="mt-2 text-sm text-[#5f6f89]">
              Detailed view of every active stock position in the portfolio.
            </p>
          </div>
          <Link
            className="inline-flex w-full items-center justify-center rounded-2xl border border-[#d6e0ef] bg-white px-4 py-2 text-sm font-semibold text-[#234067] transition hover:border-[#9cb6dc] hover:bg-[#f8fbff] sm:w-auto"
            href="/stocks"
          >
            Back to Dashboard
          </Link>
        </div>

        <StocksHoldingsTable
          currencyCode={user.profile.currency}
          emptyMessage="Add your first buy transaction to open a stock position."
          holdings={dashboard.holdings}
          subtitle="Quantity, average price, live price, unrealized profit, today movement, and allocation for every active holding."
          title="All Active Holdings"
        />
      </div>
    </div>
  );
}
