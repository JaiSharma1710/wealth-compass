"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Laptop, Moon, RefreshCw, Share, Smartphone, Sun } from "lucide-react";
import toast from "react-hot-toast";

import { DATA_SYNCED_EVENT } from "@/components/sync-status";
import { Badge, Button, Card, CardHeader, Segmented } from "@/components/ui/kit";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

type ThemeChoice = "light" | "dark" | "system";

function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem("theme");
    return stored === "dark" || stored === "light" ? stored : "system";
  } catch {
    return "system";
  }
}

export function AppearanceCard() {
  const [theme, setTheme] = useState<ThemeChoice>("system");

  useEffect(() => {
    const id = window.setTimeout(() => setTheme(readTheme()), 0);
    return () => window.clearTimeout(id);
  }, []);

  function choose(next: ThemeChoice) {
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // storage unavailable: still apply for this session
    }
    const dark = next === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches : next === "dark";
    document.documentElement.classList.toggle("dark", dark);
  }

  return (
    <Card>
      <CardHeader title="Appearance" subtitle="Applies instantly on this device." />
      <Segmented<ThemeChoice>
        ariaLabel="Theme"
        value={theme}
        onChange={choose}
        options={[
          { value: "light", label: <span className="inline-flex items-center gap-1.5"><Sun className="size-3.5" />Light</span> },
          { value: "dark", label: <span className="inline-flex items-center gap-1.5"><Moon className="size-3.5" />Dark</span> },
          { value: "system", label: <span className="inline-flex items-center gap-1.5"><Laptop className="size-3.5" />System</span> },
        ]}
      />
      <p className="mt-3 text-xs text-ink-3">System follows your phone or computer setting automatically.</p>
    </Card>
  );
}

type SyncPayload = {
  lastSyncedAt: string | null;
  syncedToday: boolean;
  failedCount: number;
  failedItems: Array<{ label: string; message: string }>;
};

export function DataSyncCard() {
  const router = useRouter();
  const [status, setStatus] = useState<SyncPayload | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/market-sync/status", { cache: "no-store" });
      const result = (await response.json().catch(() => null)) as { status?: SyncPayload } | null;
      if (!response.ok || !result?.status) throw new Error("status");
      setStatus(result.status);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    window.addEventListener(DATA_SYNCED_EVENT, load);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener(DATA_SYNCED_EVENT, load);
    };
  }, [load]);

  async function syncNow() {
    setSyncing(true);
    try {
      const response = await fetch("/api/market-sync/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType: "mixed" }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        toast.error(result?.message || "Unable to sync prices.");
        return;
      }
      toast.success(result?.message || "Prices updated.");
      window.dispatchEvent(new Event(DATA_SYNCED_EVENT));
      router.refresh();
      await load();
    } catch {
      toast.error("Unable to sync prices.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Data sync"
        subtitle="Stock, mutual fund and gold prices update automatically every day at 7:00 AM IST, and whenever you open the app."
        action={
          <Button icon={RefreshCw} loading={syncing} onClick={syncNow} variant="primary">
            Sync now
          </Button>
        }
      />
      {loadFailed ? (
        <p className="text-sm text-ink-3">Sync status is unavailable right now.</p>
      ) : !status ? (
        <p className="text-sm text-ink-3">Checking status...</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {status.lastSyncedAt ? (
              <>
                <span className="text-ink">Last synced {formatRelativeTime(status.lastSyncedAt)}</span>
                <span className="text-ink-3">({formatDateTime(status.lastSyncedAt)})</span>
                <Badge tone={status.syncedToday ? "gain" : "warn"}>
                  {status.syncedToday ? "Up to date" : "Not yet today"}
                </Badge>
              </>
            ) : (
              <span className="text-ink-3">No sync has run yet.</span>
            )}
          </div>
          {status.failedCount > 0 ? (
            <div className="rounded-xl border border-warn/30 bg-warn-soft p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-warn">
                <AlertTriangle className="size-4" />
                {status.failedCount} {status.failedCount === 1 ? "item" : "items"} could not be updated
              </p>
              <ul className="mt-2 space-y-1 text-xs text-ink-2">
                {status.failedItems.map((item, index) => (
                  <li key={`${item.label}-${index}`}>
                    <span className="font-medium text-ink">{item.label}</span>
                    {item.message ? ` — ${item.message}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : status.lastSyncedAt ? (
            <p className="flex items-center gap-1.5 text-xs text-gain">
              <CheckCircle2 className="size-3.5" /> Every holding updated in the last sync.
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

export function InstallCard() {
  return (
    <Card>
      <CardHeader title="Install app" subtitle="Add Wealth Compass to your home screen for a full-screen, app-like experience." />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-2 p-3.5">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <Smartphone className="size-4 text-brand" /> iPhone / iPad
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-ink-2">
            <li>Open this site in Safari.</li>
            <li className="[&>svg]:inline">
              Tap the Share button <Share className="mx-0.5 inline size-3.5 align-text-bottom" aria-hidden />.
            </li>
            <li>Choose <span className="font-medium text-ink">Add to Home Screen</span>, then Add.</li>
          </ol>
        </div>
        <div className="rounded-xl bg-surface-2 p-3.5">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <Smartphone className="size-4 text-brand" /> Android / Chrome
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-ink-2">
            <li>Open this site in Chrome.</li>
            <li>Tap the menu (three dots) or the install prompt.</li>
            <li>Choose <span className="font-medium text-ink">Install app</span>.</li>
          </ol>
        </div>
      </div>
    </Card>
  );
}
