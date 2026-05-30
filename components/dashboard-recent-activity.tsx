"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DashboardAssetClassKey, DashboardRecentActivityItem } from "@/lib/dashboard.types";

export function DashboardRecentActivity({
  activity,
  formatCurrency,
  formatDate,
}: {
  activity: DashboardRecentActivityItem[];
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
}) {
  const [selectedAssetKey, setSelectedAssetKey] = useState<DashboardAssetClassKey>("cash");
  const filteredActivity = useMemo(
    () =>
      activity
        .filter((item) => item.assetClassKey === selectedAssetKey)
        .slice(0, 5),
    [activity, selectedAssetKey]
  );

  const assetPills: Array<{ key: DashboardAssetClassKey; label: string }> = [
    { key: "cash", label: "Cash" },
    { key: "gold", label: "Gold" },
    { key: "stocks", label: "Stocks" },
    { key: "mutualFunds", label: "MF" },
  ];

  return (
    <section className="rounded-[28px] border border-[#dce4f0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#132842]">Recent Activity</h2>
          <p className="mt-1 text-sm text-[#6d7d97]">Latest transactions across your wealth modules.</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {assetPills.map((pill) => (
          <button
            key={pill.key}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.14em] ${
              selectedAssetKey === pill.key
                ? "bg-[#173d7a] text-white"
                : "border border-[#d5dfef] bg-white text-[#5f6f89]"
            }`}
            onClick={() => setSelectedAssetKey(pill.key)}
            type="button"
          >
            {pill.label}
          </button>
        ))}
      </div>

      {filteredActivity.length ? (
        <div className="space-y-3">
          {filteredActivity.map((item) => (
            <Link
              key={item.id}
              className="block rounded-2xl bg-[#f8fbff] px-4 py-3 transition hover:bg-[#f2f7ff]"
              href={item.href}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#17304f]">
                    {item.type} • {item.name}
                  </p>
                  <p className="mt-1 text-xs text-[#6c7a93]">
                    {formatDate(item.date)} • {item.assetClassLabel} • {item.description}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[#132842]">{formatCurrency(item.amount)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-[#d7e1ef] bg-[#f8fbff] px-5 py-12 text-center text-sm text-[#72829a]">
          No recent {assetPills.find((pill) => pill.key === selectedAssetKey)?.label.toLowerCase()} activity yet.
        </div>
      )}
    </section>
  );
}
