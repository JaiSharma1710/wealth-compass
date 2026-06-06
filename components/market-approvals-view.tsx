"use client";

import { useEffect, useState, useTransition } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import {
  MarketSyncBatchReview,
  type MarketSyncBatchSummary,
} from "@/components/market-sync-batch-review";

type MarketApprovalsViewProps = {
  currencyCode: string;
};

export function MarketApprovalsView({ currencyCode }: MarketApprovalsViewProps) {
  const [batches, setBatches] = useState<MarketSyncBatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) || batches[0] || null;

  async function loadBatches() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/market-sync/batches?source=cron&limit=50", {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as
        | { batches?: MarketSyncBatchSummary[]; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(result?.message || "Unable to load market approvals.");
      }

      const nextBatches = result?.batches || [];
      setBatches(nextBatches);
      setSelectedBatchId((current) =>
        nextBatches.some((batch) => batch.id === current) ? current : nextBatches[0]?.id || ""
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load market approvals.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBatches();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function updateBatch(updatedBatch: MarketSyncBatchSummary) {
    setBatches((current) =>
      current.map((batch) => (batch.id === updatedBatch.id ? updatedBatch : batch))
    );
    setSelectedBatchId(updatedBatch.id);
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f5f7fb]">
      <section className="flex min-h-full flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-[#dce3ef] bg-white px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7c8aa5]">
                Market Data Approvals
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#10203a]">
                Review scheduled values
              </h1>
              <p className="mt-2 text-sm text-[#72829a]">
                Approve all rows or only the values you trust, then sync approved rows to the DB.
              </p>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d6e0ef] bg-white px-4 py-2 text-sm font-semibold text-[#234067] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading || isRefreshing}
              onClick={() => startRefreshTransition(loadBatches)}
              type="button"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Reload
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[24rem] items-center justify-center rounded-[28px] border border-[#dce4f0] bg-white text-[#5f6f89]">
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
            Loading approvals...
          </div>
        ) : batches.length ? (
          <div className="grid gap-6 xl:grid-cols-[20rem_1fr]">
            <aside className="rounded-[24px] border border-[#dce4f0] bg-white p-3 shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
              <div className="px-2 pb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8aa5]">
                Batches
              </div>
              <div className="space-y-2">
                {batches.map((batch) => (
                  <button
                    key={batch.id}
                    className={`w-full rounded-2xl px-3 py-3 text-left text-sm transition ${
                      selectedBatch?.id === batch.id
                        ? "bg-[#173d7a] text-white"
                        : "border border-[#e6edf7] bg-white text-[#34425a] hover:bg-[#f8fbff]"
                    }`}
                    onClick={() => setSelectedBatchId(batch.id)}
                    type="button"
                  >
                    <div className="font-semibold">{batch.date}</div>
                    <div className={selectedBatch?.id === batch.id ? "text-white/75" : "text-[#708099]"}>
                      {batch.items.length} rows • {batch.status}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {selectedBatch ? (
              <MarketSyncBatchReview
                batch={selectedBatch}
                currencyCode={currencyCode}
                onBatchChange={updateBatch}
                onSynced={loadBatches}
              />
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#d7e1ef] bg-white px-6 text-center">
            <h2 className="text-xl font-semibold text-[#132842]">No scheduled approvals yet</h2>
            <p className="mt-2 max-w-md text-sm text-[#6d7d97]">
              The 7:00 AM market data cron will create pending batches here when there are active stock or mutual fund holdings.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
