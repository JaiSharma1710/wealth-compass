"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type SyncStatusPayload = {
  lastSyncedAt: string | null;
  syncedToday: boolean;
  failedCount: number;
  failedItems: Array<{ label: string; message: string }>;
};

/** Fired after prices change so client views can refetch their data. */
export const DATA_SYNCED_EVENT = "wc:data-synced";

const AUTO_SYNC_KEY = "wc:last-auto-sync";
const AUTO_SYNC_COOLDOWN_MS = 30 * 60 * 1000;

/**
 * Header chip showing when prices were last refreshed. If today's 7 AM sync hasn't
 * happened yet (cron delayed, app opened early), it syncs automatically on open.
 */
export function SyncStatus() {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatusPayload | null>(null);
  const [syncing, setSyncing] = useState(false);
  const autoTriedRef = useRef(false);

  const runSync = useCallback(
    async (mode: "auto" | "manual") => {
      setSyncing(true);

      try {
        const response = await fetch("/api/market-sync/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetType: "mixed" }),
        });

        if (!response.ok) {
          throw new Error("Price refresh failed.");
        }

        const next = await fetch("/api/market-sync/status", { cache: "no-store" }).then((res) => res.json());
        setStatus(next.status);
        window.dispatchEvent(new Event(DATA_SYNCED_EVENT));
        router.refresh();

        if (mode === "manual") {
          toast.success(
            next.status?.failedCount
              ? `Prices updated · ${next.status.failedCount} could not refresh`
              : "Prices updated"
          );
        }
      } catch (error) {
        if (mode === "manual") {
          toast.error(error instanceof Error ? error.message : "Price refresh failed.");
        }
      } finally {
        setSyncing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;

    fetch("/api/market-sync/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { status?: SyncStatusPayload } | null) => {
        if (cancelled || !result?.status) return;
        setStatus(result.status);

        if (result.status.syncedToday || autoTriedRef.current) return;

        let lastAttempt = 0;
        try {
          lastAttempt = Number(localStorage.getItem(AUTO_SYNC_KEY) || 0);
        } catch {}

        if (Date.now() - lastAttempt < AUTO_SYNC_COOLDOWN_MS) return;

        autoTriedRef.current = true;
        try {
          localStorage.setItem(AUTO_SYNC_KEY, String(Date.now()));
        } catch {}
        void runSync("auto");
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [runSync]);

  const hasFailures = Boolean(status?.syncedToday && status.failedCount > 0);
  const label = syncing
    ? "Updating prices…"
    : status?.lastSyncedAt
      ? `Updated ${formatRelativeTime(status.lastSyncedAt)}`
      : "Not synced yet";
  const title = syncing
    ? "Fetching the latest prices"
    : `${status?.lastSyncedAt ? `Last price sync: ${formatDateTime(status.lastSyncedAt)}` : "No price sync yet"}${
        hasFailures ? `\nCould not refresh: ${status!.failedItems.map((item) => item.label).join(", ")}` : ""
      }\nPrices refresh automatically every day at 7:00 AM. Tap to refresh now.`;
  const Icon = syncing ? LoaderCircle : hasFailures ? AlertTriangle : status?.syncedToday ? CheckCircle2 : RefreshCw;

  return (
    <button
      type="button"
      onClick={() => void runSync("manual")}
      disabled={syncing}
      title={title}
      aria-label={`${label}. Refresh prices`}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-2.5 text-xs font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:cursor-progress",
        hasFailures && "border-warn/30 text-warn"
      )}
    >
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          syncing && "animate-spin",
          !syncing && !hasFailures && status?.syncedToday && "text-gain"
        )}
      />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
