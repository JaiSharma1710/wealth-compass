"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";

import { Button, Skeleton } from "@/components/ui/kit";
import { Field, FieldGrid, Input, Sheet } from "@/components/ui/sheet";
import { formatMoney } from "@/lib/format";
import type { GoldHoldingSummary, GoldTrackerInfo } from "@/lib/gold.types";

type Suggestion = { symbol: string; price: number | null; suggestedUnits: number | null };

export function GoldAutoPricingSheet(props: Props) {
  return props.holding ? <Body key={props.holding.id} {...props} holding={props.holding} /> : null;
}

type Props = {
  holding: GoldHoldingSummary | null;
  tracker: GoldTrackerInfo | null;
  currency: string;
  onClose: () => void;
  onSave: (input: { holdingId: string; symbol: string; units: number }) => Promise<void>;
};

function Body({
  holding,
  tracker,
  currency,
  onClose,
  onSave,
}: Props & { holding: GoldHoldingSummary }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [price, setPrice] = useState<number | null>(tracker?.lastPrice ?? null);
  const [symbol, setSymbol] = useState(tracker?.symbol || "");
  const [units, setUnits] = useState(tracker?.units ? String(tracker.units) : "");
  const [error, setError] = useState("");
  const holdingId = holding.id;
  const trackerPrice = tracker?.lastPrice ?? null;

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/gold/trackers?suggest=${encodeURIComponent(holdingId)}`, { signal: controller.signal })
      .then((response) => response.json().catch(() => null))
      .then((result: { suggestion?: Suggestion } | null) => {
        const suggestion = result?.suggestion;
        if (!suggestion) return;
        setPrice(suggestion.price ?? trackerPrice);
        setSymbol((current) => current || suggestion.symbol);
        setUnits((current) => current || (suggestion.suggestedUnits ? String(suggestion.suggestedUnits) : ""));
      })
      .catch(() => null)
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [holdingId, trackerPrice]);

  const unitsNumber = Number(units);
  const preview = price && unitsNumber > 0 ? price * unitsNumber : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!symbol.trim()) return setError("Ticker symbol is required.");
    if (!(unitsNumber > 0)) return setError("Enter the number of units you hold.");

    setError("");
    setSaving(true);

    try {
      await onSave({ holdingId: holding.id, symbol: symbol.trim().toUpperCase(), units: unitsNumber });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to enable auto-pricing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={tracker ? "Auto-pricing" : "Enable auto-pricing"}
      description={`${holding.schemeName} · ${holding.investmentOptionLabel}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="gold-autoprice-form" loading={saving}>
            {tracker ? "Update" : "Enable"}
          </Button>
        </div>
      }
    >
      <form id="gold-autoprice-form" className="space-y-4" onSubmit={submit} noValidate>
        <div className="flex gap-2.5 rounded-xl bg-brand-soft p-3 text-xs leading-relaxed text-brand-ink">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Value = units × market price, refreshed every morning. You will no longer need to type a valuation each day.
            Past entries stay as they are.
          </p>
        </div>

        <FieldGrid>
          <Field label="Yahoo ticker" hint="e.g. SGBMAY29I-GB.NS for bonds, GOLDBEES.NS for ETFs">
            <Input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="SGBMAY29I-GB.NS" autoCapitalize="characters" />
          </Field>
          <Field label="Units held" hint="SGBs are issued in grams (1 unit = 1 g)">
            <Input value={units} onChange={(event) => setUnits(event.target.value)} type="number" step="any" inputMode="decimal" placeholder="10" />
          </Field>
        </FieldGrid>

        <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm">
          {loading ? (
            <Skeleton className="h-5 w-40" />
          ) : price ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-ink-3">Live price</span>
                <span className="tabular font-medium text-ink">{formatMoney(price, { currency })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Estimated value</span>
                <span className="tabular font-medium text-ink">
                  {preview ? formatMoney(preview, { currency, decimals: 0 }) : "Enter units"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Current recorded value</span>
                <span className="tabular text-ink-2">{formatMoney(holding.currentValue, { currency, decimals: 0 })}</span>
              </div>
            </div>
          ) : (
            <p className="text-ink-3">
              Live price is unavailable right now. Enter the units you hold; the value will be filled in at the next sync.
            </p>
          )}
        </div>

        {error ? <p className="text-xs text-loss">{error}</p> : null}
      </form>
    </Sheet>
  );
}
