"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { DashboardView } from "@/components/dashboard-view";
import { PageLoadingState } from "@/components/page-loading-state";
import type { DashboardData } from "@/lib/dashboard.types";

export function DashboardPageClient({ currencyCode }: { currencyCode: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as
          | { dashboard?: DashboardData; message?: string }
          | null;

        if (!response.ok || !result?.dashboard) {
          throw new Error(result?.message || "Unable to load dashboard.");
        }

        setData(result.dashboard);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Unable to load dashboard.";
        setError(message);
        toast.error(message);
      }
    }

    void loadDashboard();

    return () => controller.abort();
  }, []);

  if (error) {
    return <PageLoadingState label={error} />;
  }

  if (!data) {
    return <PageLoadingState label="Loading dashboard..." />;
  }

  return <DashboardView currencyCode={currencyCode} initialData={data} />;
}
