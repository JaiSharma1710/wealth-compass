import Link from "next/link";

import { MutualFundsHoldingsTable } from "@/components/mutual-funds-holdings-table";
import { requireCurrentUser } from "@/lib/auth";
import { getMutualFundDashboard } from "@/lib/mutual-funds";

export default async function MutualFundHoldingsPage() {
  const user = await requireCurrentUser();
  const dashboard = await getMutualFundDashboard(user.id);

  return (
    <div className="h-full overflow-y-auto bg-[#f5f7fb] p-4 sm:p-6">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-6">
        <div className="flex items-center justify-between gap-4 rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-neutral-500">Mutual Funds</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              All Holdings
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Detailed view of every tracked mutual fund in the portfolio.
            </p>
          </div>
          <Link
            className="inline-flex items-center rounded-[1rem] border border-[#dbe2ee] px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
            href="/mutual-funds"
          >
            Back to Dashboard
          </Link>
        </div>

        <MutualFundsHoldingsTable
          currencyCode={user.profile.currency}
          emptyMessage="No holdings yet. Add your first mutual fund purchase to start tracking."
          holdings={dashboard.holdings}
          subtitle="Average NAV, current NAV, units, invested value, current value, and live profit for every fund."
          title="All Fund Holdings"
        />
      </div>
    </div>
  );
}
