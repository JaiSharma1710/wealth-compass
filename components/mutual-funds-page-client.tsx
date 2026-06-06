"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { MutualFundsView } from "@/components/mutual-funds-view";
import { PageLoadingState } from "@/components/page-loading-state";
import type { MutualFundDashboardData } from "@/lib/mutual-funds.types";

export function MutualFundsPageClient({ currencyCode }: { currencyCode: string }) {
  const [data, setData] = useState<MutualFundDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMutualFunds() {
      try {
        const response = await fetch("/api/mutual-funds", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as
          | { dashboard?: MutualFundDashboardData; message?: string }
          | null;

        if (!response.ok || !result?.dashboard) {
          throw new Error(result?.message || "Unable to load mutual funds.");
        }

        setData(result.dashboard);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : "Unable to load mutual funds.";
        setError(message);
        toast.error(message);
      }
    }

    void loadMutualFunds();

    return () => controller.abort();
  }, []);

  if (error) {
    return <PageLoadingState label={error} />;
  }

  if (!data) {
    return <PageLoadingState label="Loading mutual funds..." />;
  }

  return <MutualFundsView currencyCode={currencyCode} initialData={data} />;
}
