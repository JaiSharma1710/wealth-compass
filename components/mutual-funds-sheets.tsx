"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/kit";
import { Field, FieldGrid, Input, Select, Sheet } from "@/components/ui/sheet";
import { formatMoney, formatNumber } from "@/lib/format";
import type {
  MutualFundDashboardData,
  MutualFundHoldingSummary,
  MutualFundOptionSummary,
} from "@/lib/mutual-funds.types";

type SchemeOption = { schemeCode: number; schemeName: string };

const todayKey = () => new Date().toISOString().slice(0, 10);

type Mode = "buy" | "sell";

function TradeSheetInner({
  mode,
  onClose,
  holdings,
  previousFunds,
  presetSchemeCode,
  currency,
  onSaved,
}: {
  mode: Mode;
  onClose: () => void;
  holdings: MutualFundHoldingSummary[];
  previousFunds: MutualFundOptionSummary[];
  presetSchemeCode?: number | null;
  currency: string;
  onSaved: (dashboard: MutualFundDashboardData | null) => void;
}) {
  const open = true;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchemeOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [fund, setFund] = useState<SchemeOption | null>(() => {
    if (mode === "sell") {
      const preset = holdings.find((item) => item.schemeCode === presetSchemeCode) || holdings[0];
      return preset ? { schemeCode: preset.schemeCode, schemeName: preset.schemeName } : null;
    }
    const preset = previousFunds.find((item) => item.schemeCode === presetSchemeCode);
    return preset ? { schemeCode: preset.schemeCode, schemeName: preset.schemeName } : null;
  });
  const [units, setUnits] = useState("");
  const [nav, setNav] = useState("");
  const [date, setDate] = useState(todayKey());
  const [navInfo, setNavInfo] = useState<{ code: number; nav: number | null; error: string | null } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const searchSeq = useRef(0);

  // Latest NAV hint for the selected fund.
  useEffect(() => {
    if (!open || !fund) return;
    const controller = new AbortController();
    const code = fund.schemeCode;

    fetch(`/api/mutual-funds/latest-nav?schemeCode=${fund.schemeCode}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { latestNav?: number; message?: string } | null;
        if (!response.ok || typeof result?.latestNav !== "number") {
          throw new Error(result?.message || "Latest NAV isn't available yet.");
        }
        setNavInfo({ code, nav: result.latestNav, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setNavInfo({ code, nav: null, error: error instanceof Error ? error.message : "Latest NAV isn't available yet." });
        }
      });

    return () => controller.abort();
  }, [open, fund]);

  // Debounced scheme search.
  useEffect(() => {
    if (mode !== "buy" || query.trim().length < 2) {
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/mutual-funds/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
        const result = (await response.json().catch(() => null)) as { options?: SchemeOption[]; message?: string } | null;
        if (!response.ok) throw new Error(result?.message || "Unable to search mutual funds.");
        if (seq === searchSeq.current) setResults(result?.options || []);
      } catch (error) {
        if (seq === searchSeq.current) {
          setResults([]);
          toast.error(error instanceof Error ? error.message : "Unable to search mutual funds.");
        }
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, mode]);

  const latestNav = navInfo && fund && navInfo.code === fund.schemeCode ? navInfo.nav : null;
  const navError = navInfo && fund && navInfo.code === fund.schemeCode ? navInfo.error : null;
  const visibleResults = query.trim().length >= 2 ? results : [];
  const held = fund ? holdings.find((item) => item.schemeCode === fund.schemeCode) : null;
  const unitsNumber = Number(units);
  const navNumber = Number(nav);
  const total = unitsNumber > 0 && navNumber > 0 ? unitsNumber * navNumber : null;

  async function submit() {
    if (!mode) return;
    const next: Record<string, string> = {};
    if (!fund) next.fund = mode === "buy" ? "Select a previous fund or search for a mutual fund." : "Please choose a fund.";
    if (!(unitsNumber > 0)) next.units = "Units must be greater than zero.";
    else if (mode === "sell" && held && unitsNumber > held.units + 0.0001) next.units = `You only hold ${formatNumber(held.units, 4)} units.`;
    if (!(navNumber > 0)) next.nav = "NAV must be greater than zero.";
    if (!date) next.date = "Date is required.";
    setErrors(next);
    if (Object.keys(next).length || !fund) return;

    setSaving(true);
    try {
      const response = await fetch("/api/mutual-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionType: mode,
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          units: unitsNumber,
          nav: navNumber,
          date,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string; dashboard?: MutualFundDashboardData }
        | null;
      if (!response.ok) throw new Error(result?.message || "Unable to save the transaction.");
      toast.success(result?.message || (mode === "buy" ? "Purchase saved." : "Sale saved."));
      onSaved(result?.dashboard || null);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the transaction.");
    } finally {
      setSaving(false);
    }
  }

  const isBuy = mode === "buy";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isBuy ? "Add purchase" : "Record sale"}
      description={isBuy ? "Log units you bought. Prices refresh automatically afterwards." : "Log units you redeemed. Realised profit is calculated on average cost."}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {isBuy ? "Save purchase" : "Save sale"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {isBuy ? (
          <>
            {previousFunds.length ? (
              <Field label="Previously held fund">
                <Select
                  value={fund && previousFunds.some((item) => item.schemeCode === fund.schemeCode) ? String(fund.schemeCode) : ""}
                  onChange={(event) => {
                    const chosen = previousFunds.find((item) => String(item.schemeCode) === event.target.value);
                    setFund(chosen ? { schemeCode: chosen.schemeCode, schemeName: chosen.schemeName } : null);
                    setQuery("");
                    setResults([]);
                  }}
                >
                  <option value="">Select a fund</option>
                  {previousFunds.map((item) => (
                    <option key={item.schemeCode} value={item.schemeCode}>
                      {item.schemeName}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Or search any fund" error={errors.fund} hint="Type at least 2 characters.">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Parag Parikh Flexi Cap" />
              </div>
              {searching ? <p className="mt-1.5 text-xs text-ink-3">Searching…</p> : null}
              {visibleResults.length ? (
                <ul className="mt-2 max-h-52 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
                  {visibleResults.map((option) => (
                    <li key={option.schemeCode}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-surface-2"
                        onClick={() => {
                          setFund(option);
                          setResults([]);
                          setQuery("");
                        }}
                      >
                        <span className="block text-sm text-ink">{option.schemeName}</span>
                        <span className="text-xs text-ink-3">Scheme code {option.schemeCode}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Field>
          </>
        ) : (
          <Field label="Fund" error={errors.fund}>
            <Select
              value={fund ? String(fund.schemeCode) : ""}
              onChange={(event) => {
                const chosen = holdings.find((item) => String(item.schemeCode) === event.target.value);
                setFund(chosen ? { schemeCode: chosen.schemeCode, schemeName: chosen.schemeName } : null);
              }}
            >
              {holdings.map((item) => (
                <option key={item.schemeCode} value={item.schemeCode}>
                  {item.schemeName}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {fund ? (
          <div className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
            <p className="font-medium text-ink">{fund.schemeName}</p>
            <p className="mt-0.5 text-xs text-ink-3">
              {navError ? navError : latestNav != null ? `Latest NAV ${formatMoney(latestNav, { currency, decimals: 4 })}` : "Loading latest NAV…"}
              {held ? ` · You hold ${formatNumber(held.units, 4)} units` : ""}
            </p>
            {latestNav != null && !nav ? (
              <button type="button" className="mt-1 text-xs font-medium text-brand" onClick={() => setNav(String(latestNav))}>
                Use latest NAV
              </button>
            ) : null}
          </div>
        ) : null}

        <FieldGrid>
          <Field label={isBuy ? "Units bought" : "Units sold"} error={errors.units}>
            <Input type="number" inputMode="decimal" step="0.0001" placeholder="125.50" value={units} onChange={(event) => setUnits(event.target.value)} />
          </Field>
          <Field label="NAV" error={errors.nav}>
            <Input type="number" inputMode="decimal" step="0.0001" placeholder="87.45" value={nav} onChange={(event) => setNav(event.target.value)} />
          </Field>
        </FieldGrid>
        <Field label={isBuy ? "Purchase date" : "Sale date"} error={errors.date}>
          <Input type="date" max={todayKey()} value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        {total != null ? (
          <p className="text-sm text-ink-2">
            {isBuy ? "Amount invested" : "Sale proceeds"}: <span className="tabular font-semibold text-ink">{formatMoney(total, { currency })}</span>
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

export function MutualFundTradeSheet(props: Omit<Parameters<typeof TradeSheetInner>[0], "mode"> & { mode: Mode | null }) {
  const { mode, ...rest } = props;

  return mode ? <TradeSheetInner key={`${mode}-${rest.presetSchemeCode ?? "none"}`} mode={mode} {...rest} /> : null;
}

export function ConfirmDeleteSheet({
  open,
  title,
  message,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            Delete
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-2">{message}</p>
    </Sheet>
  );
}
