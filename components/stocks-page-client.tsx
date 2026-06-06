"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { PageLoadingState } from "@/components/page-loading-state";
import { StocksView } from "@/components/stocks-view";
import type { StockDashboardData } from "@/lib/stocks.types";

export function StocksPageClient({ currencyCode }: { currencyCode: string }) {
  const [data, setData] = useState<StockDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStocks() {
      try {
        const response = await fetch("/api/stocks", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as
          | { dashboard?: StockDashboardData; message?: string }
          | null;

        if (!response.ok || !result?.dashboard) {
          throw new Error(result?.message || "Unable to load stocks.");
        }

        setData(result.dashboard);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Unable to load stocks.";
        setError(message);
        toast.error(message);
      }
    }

    void loadStocks();

    return () => controller.abort();
  }, []);

  if (error) {
    return <PageLoadingState label={error} />;
  }

  if (!data) {
    return <PageLoadingState label="Loading stocks..." />;
  }

  return <StocksView currencyCode={currencyCode} initialData={data} />;
}
