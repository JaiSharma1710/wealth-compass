"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, CheckCheck, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export type MarketSyncItemSummary = {
  id: string;
  itemKey: string;
  assetType: "stock" | "mutual_fund";
  assetKey: string;
  assetLabel: string;
  quantityOrUnits: number;
  investedAmount: number;
  oldPriceOrNav: number | null;
  oldValue: number;
  oldSyncedAt: string | null;
  newPriceOrNav: number | null;
  newValue: number;
  newFetchedAt: string;
  changeAmount: number;
  changePercent: number | null;
  status: "pending" | "approved" | "synced" | "skipped" | "error";
  errorMessage: string;
};

export type MarketSyncBatchSummary = {
  id: string;
  userId: string;
  date: string;
  source: "cron" | "manual";
  assetType: "stock" | "mutual_fund" | "mixed";
  status: "pending" | "partially_approved" | "approved" | "synced" | "discarded" | "error";
  fetchedAt: string;
  syncedAt: string | null;
  itemCounts: Record<MarketSyncItemSummary["status"], number>;
  items: MarketSyncItemSummary[];
  errorMessage: string;
};

type MarketSyncBatchReviewProps = {
  batch: MarketSyncBatchSummary;
  currencyCode: string;
  onBatchChange: (batch: MarketSyncBatchSummary) => void;
  onSynced?: () => void;
  compact?: boolean;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not synced";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function MarketSyncBatchReview({
  batch,
  currencyCode,
  onBatchChange,
  onSynced,
  compact = false,
}: MarketSyncBatchReviewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currencyCode || "INR",
        maximumFractionDigits: 2,
      }),
    [currencyCode]
  );
  const pendingItems = batch.items.filter((item) => item.status === "pending");
  const approvedItems = batch.items.filter((item) => item.status === "approved");
  const canApproveSelected = selectedIds.length > 0;
  const canApproveAll = pendingItems.length > 0;
  const canSync = approvedItems.length > 0;

  function toggleItem(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    );
  }

  async function runBatchAction(
    endpoint: "approve" | "sync" | "discard",
    body?: Record<string, unknown>
  ) {
    const response = await fetch(`/api/market-sync/batches/${batch.id}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const result = (await response.json().catch(() => null)) as
      | { batch?: MarketSyncBatchSummary; message?: string }
      | null;

    if (!response.ok || !result?.batch) {
      throw new Error(result?.message || "Unable to update market sync batch.");
    }

    onBatchChange(result.batch);
    setSelectedIds([]);

    if (endpoint === "sync") {
      onSynced?.();
    }

    return result;
  }

  function approveSelected() {
    startTransition(async () => {
      try {
        await runBatchAction("approve", { itemIds: selectedIds });
        toast.success("Selected rows approved.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to approve rows.");
      }
    });
  }

  function approveAll() {
    startTransition(async () => {
      try {
        await runBatchAction("approve");
        toast.success("All pending rows approved.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to approve rows.");
      }
    });
  }

  function syncApproved() {
    startTransition(async () => {
      try {
        const result = await runBatchAction("sync");
        toast.success(result.message || "Approved rows synced.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to sync rows.");
      }
    });
  }

  function discardBatch() {
    startTransition(async () => {
      try {
        const result = await runBatchAction("discard");
        toast.success(result.message || "Batch discarded.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to discard batch.");
      }
    });
  }

  return (
    <div className="rounded-[20px] border border-[#dce4f0] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 border-b border-[#e6edf7] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8aa5]">
            {batch.source === "cron" ? "Scheduled Sync" : "Manual Refresh"} •{" "}
            {formatStatus(batch.assetType)}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#132842]">
            Market values for {batch.date}
          </h2>
          <p className="mt-1 text-sm text-[#6d7d97]">
            Fetched {formatDateTime(batch.fetchedAt)} • Status: {formatStatus(batch.status)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-[#d6e0ef] bg-white px-3.5 py-2 text-sm font-semibold text-[#234067] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canApproveSelected || isPending}
            onClick={approveSelected}
            type="button"
          >
            <Check className="h-4 w-4" />
            Approve Selected
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-[#d6e0ef] bg-white px-3.5 py-2 text-sm font-semibold text-[#234067] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canApproveAll || isPending}
            onClick={approveAll}
            type="button"
          >
            <CheckCheck className="h-4 w-4" />
            Approve All
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-[#111111] px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSync || isPending}
            onClick={syncApproved}
            type="button"
          >
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Approved
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-[#f1c9c9] bg-white px-3.5 py-2 text-sm font-semibold text-[#a43232] transition hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={batch.status === "synced" || batch.status === "discarded" || isPending}
            onClick={discardBatch}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Discard
          </button>
        </div>
      </div>

      {batch.errorMessage ? (
        <div className="mx-5 mt-4 rounded-2xl border border-[#f4d6a0] bg-[#fff8eb] px-4 py-3 text-sm text-[#8a6120]">
          {batch.errorMessage}
        </div>
      ) : null}

      <div className={compact ? "max-h-[60vh] overflow-auto" : "overflow-x-auto"}>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[#e6edf7] text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#7c8aa5]">
              <th className="w-12 px-4 py-3"></th>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Old Value</th>
              <th className="px-4 py-3">New Value</th>
              <th className="px-4 py-3">Change</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {batch.items.map((item) => {
              const selectable = item.status === "pending";
              const positive = item.changeAmount >= 0;

              return (
                <tr key={item.id} className="border-b border-[#eef3fa] text-[#233a5f]">
                  <td className="px-4 py-3">
                    <input
                      checked={selectedIds.includes(item.id)}
                      className="size-4 rounded border-[#cbd7e7]"
                      disabled={!selectable || isPending}
                      onChange={() => toggleItem(item.id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{item.assetLabel}</div>
                    <div className="text-xs text-[#708099]">
                      {item.assetType === "stock" ? "Stock" : "Mutual Fund"} • {item.assetKey} •{" "}
                      Qty/Units {item.quantityOrUnits}
                    </div>
                    {item.errorMessage ? (
                      <div className="mt-1 text-xs text-[#a43232]">{item.errorMessage}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div>{formatter.format(item.oldValue)}</div>
                    <div className="text-xs text-[#708099]">
                      {item.oldPriceOrNav == null ? "No saved price" : formatter.format(item.oldPriceOrNav)}
                    </div>
                    <div className="text-xs text-[#708099]">{formatDateTime(item.oldSyncedAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{formatter.format(item.newValue)}</div>
                    <div className="text-xs text-[#708099]">
                      {item.newPriceOrNav == null ? "Unavailable" : formatter.format(item.newPriceOrNav)}
                    </div>
                    <div className="text-xs text-[#708099]">{formatDateTime(item.newFetchedAt)}</div>
                  </td>
                  <td className={`px-4 py-3 ${positive ? "text-[#0f7a56]" : "text-[#b23434]"}`}>
                    <div>{positive ? "+" : ""}{formatter.format(item.changeAmount)}</div>
                    <div className="text-xs">
                      {item.changePercent == null
                        ? "New baseline"
                        : `${item.changePercent >= 0 ? "+" : ""}${item.changePercent.toFixed(2)}%`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#f2f5ef] px-2.5 py-1 text-xs font-semibold text-[#34425a]">
                      {formatStatus(item.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
