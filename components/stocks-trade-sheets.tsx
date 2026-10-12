"use client";

import { useState, type FormEvent } from "react";
import { AsyncTypeahead, Highlighter } from "react-bootstrap-typeahead";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/kit";
import { Field, FieldGrid, Input, Select, Sheet, Textarea } from "@/components/ui/sheet";
import { formatMoney } from "@/lib/format";
import type { StockDashboardData, StockHoldingSummary, StockSearchResult } from "@/lib/stocks.types";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function displaySymbol(symbol: string) {
  return symbol.replace(/\.(NS|BO)$/, "");
}

async function postTrade(endpoint: string, payload: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => null)) as
    | { message?: string; dashboard?: StockDashboardData }
    | null;

  if (!response.ok) {
    throw new Error(result?.message || "Unable to save the transaction.");
  }

  return result;
}

export function StockBuySheet({
  open,
  onClose,
  onSaved,
  currency,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (dashboard: StockDashboardData | undefined) => void;
  currency: string;
  /** Pre-select a stock (e.g. "Buy more" from a holding). */
  preset?: StockSearchResult | null;
}) {
  const [selected, setSelected] = useState<StockSearchResult[]>(preset ? [preset] : []);
  const [options, setOptions] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [charges, setCharges] = useState("");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const total = Number(quantity) * Number(price) + (Number(charges) || 0);

  async function search(query: string) {
    setSearching(true);

    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const result = (await response.json().catch(() => null)) as { options?: StockSearchResult[] } | null;
      setOptions(result?.options || []);
    } catch {
      setOptions([]);
    } finally {
      setSearching(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const stock = selected[0];

    if (!stock) {
      toast.error("Choose a stock from the list.");
      return;
    }

    setSaving(true);

    try {
      const result = await postTrade("/api/stocks/buy", {
        symbol: stock.symbol,
        exchange: stock.exchange,
        companyName: stock.companyName,
        shortName: stock.shortName,
        sector: stock.sector,
        industry: stock.industry,
        quantity: Number(quantity),
        price: Number(price),
        charges: Number(charges) || 0,
        transactionDate: date,
        note,
      });
      toast.success(result?.message || "Purchase saved");
      onSaved(result?.dashboard);
      setQuantity("");
      setPrice("");
      setCharges("");
      setNote("");
      setSelected([]);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save purchase.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Buy stock"
      description="Prices update automatically after saving."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="stock-buy-form" loading={saving}>
            Save purchase
          </Button>
        </>
      }
    >
      <form id="stock-buy-form" className="space-y-3" onSubmit={submit}>
        <Field label="Stock">
          <AsyncTypeahead
            id="stock-buy-typeahead"
            filterBy={() => true}
            isLoading={searching}
            labelKey={(option) =>
              typeof option === "string" ? option : `${displaySymbol(option.symbol)} · ${option.companyName}`
            }
            minLength={1}
            onChange={(value) => setSelected(value as StockSearchResult[])}
            onSearch={search}
            options={options}
            placeholder="Search company or symbol"
            selected={selected}
            useCache={false}
            inputProps={{
              className:
                "block h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:ring-3 focus:ring-brand/15",
            }}
            renderMenuItemChildren={(option) => {
              const stock = option as StockSearchResult;
              return (
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    <Highlighter search={stock.shortName}>{displaySymbol(stock.symbol)}</Highlighter>
                  </span>
                  <span className="text-xs text-ink-3">
                    {stock.companyName} · {stock.exchange}
                  </span>
                </div>
              );
            }}
          />
        </Field>
        <FieldGrid>
          <Field label="Quantity">
            <Input required inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="10" />
          </Field>
          <Field label="Price per share">
            <Input required inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="1,250.50" />
          </Field>
          <Field label="Brokerage & charges" hint="Optional">
            <Input inputMode="decimal" value={charges} onChange={(event) => setCharges(event.target.value)} placeholder="0" />
          </Field>
          <Field label="Date">
            <Input required type="date" max={todayKey()} value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </FieldGrid>
        <Field label="Note" hint="Optional">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
        </Field>
        {Number.isFinite(total) && total > 0 ? (
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
            Total cost <span className="tabular font-semibold text-ink">{formatMoney(total, { currency })}</span>
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

export function StockSellSheet({
  open,
  onClose,
  onSaved,
  holdings,
  currency,
  initialSymbol,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (dashboard: StockDashboardData | undefined) => void;
  holdings: StockHoldingSummary[];
  currency: string;
  initialSymbol?: string | null;
}) {
  const [symbol, setSymbol] = useState(initialSymbol || holdings[0]?.symbol || "");
  const holding = holdings.find((entry) => entry.symbol === symbol) || null;
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(holding?.currentPrice ? String(holding.currentPrice) : "");
  const [charges, setCharges] = useState("");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const proceeds = Number(quantity) * Number(price) - (Number(charges) || 0);
  const profit = holding ? proceeds - Number(quantity) * holding.averagePrice : null;

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!holding) {
      toast.error("Choose a holding to sell.");
      return;
    }

    setSaving(true);

    try {
      const result = await postTrade("/api/stocks/sell", {
        symbol: holding.symbol,
        quantity: Number(quantity),
        price: Number(price),
        charges: Number(charges) || 0,
        transactionDate: date,
        note,
      });
      toast.success(result?.message || "Sale saved");
      onSaved(result?.dashboard);
      setQuantity("");
      setNote("");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save sale.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Sell stock"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="stock-sell-form" loading={saving} disabled={!holding}>
            Save sale
          </Button>
        </>
      }
    >
      <form id="stock-sell-form" className="space-y-3" onSubmit={submit}>
        <Field label="Holding">
          <Select
            value={symbol}
            onChange={(event) => {
              const next = holdings.find((entry) => entry.symbol === event.target.value);
              setSymbol(event.target.value);
              setPrice(next?.currentPrice ? String(next.currentPrice) : "");
            }}
          >
            {holdings.map((entry) => (
              <option key={entry.symbol} value={entry.symbol}>
                {displaySymbol(entry.symbol)} · {entry.quantity} shares
              </option>
            ))}
          </Select>
        </Field>
        <FieldGrid>
          <Field label="Quantity" hint={holding ? `You hold ${holding.quantity}` : undefined}>
            <Input
              required
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder={holding ? String(holding.quantity) : ""}
            />
          </Field>
          <Field label="Price per share">
            <Input required inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
          </Field>
          <Field label="Brokerage & charges" hint="Optional">
            <Input inputMode="decimal" value={charges} onChange={(event) => setCharges(event.target.value)} placeholder="0" />
          </Field>
          <Field label="Date">
            <Input required type="date" max={todayKey()} value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </FieldGrid>
        <Field label="Note" hint="Optional">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
        </Field>
        {holding && Number(quantity) > 0 && Number(price) > 0 ? (
          <div className="flex justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
            <span>
              Proceeds <span className="tabular font-semibold text-ink">{formatMoney(proceeds, { currency })}</span>
            </span>
            <span>
              Realised{" "}
              <span className={`tabular font-semibold ${(profit || 0) >= 0 ? "text-gain" : "text-loss"}`}>
                {formatMoney(profit, { currency, sign: true })}
              </span>
            </span>
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}
