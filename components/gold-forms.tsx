"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/kit";
import { Field, FieldGrid, Input, Select, Sheet } from "@/components/ui/sheet";
import { formatMoney } from "@/lib/format";
import { GOLD_INVESTMENT_OPTIONS } from "@/lib/gold.types";
import type { GoldHoldingSummary } from "@/lib/gold.types";

export type GoldFormKind = "buy" | "sell" | "valuation";

export type GoldFormPayload = Record<string, unknown>;

type Values = {
  date: string;
  investmentOption: string;
  schemeName: string;
  holdingId: string;
  investedAmount: string;
  currentValue: string;
  sellAmount: string;
  units: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const TITLES: Record<GoldFormKind, { title: string; description: string; submit: string }> = {
  buy: {
    title: "Buy gold",
    description: "Record a new purchase. It becomes a holding you can track.",
    submit: "Save purchase",
  },
  sell: {
    title: "Sell gold",
    description: "Record a sale from an existing holding.",
    submit: "Save sale",
  },
  valuation: {
    title: "Update value",
    description: "Set today's value by hand. Auto-priced holdings update themselves every morning.",
    submit: "Update value",
  },
};

export function GoldTransactionSheet({
  kind,
  holdings,
  initialHoldingId,
  currency,
  onClose,
  onSave,
}: {
  kind: GoldFormKind | null;
  holdings: GoldHoldingSummary[];
  initialHoldingId?: string;
  currency: string;
  onClose: () => void;
  onSave: (payload: GoldFormPayload) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>();

  useEffect(() => {
    if (!kind) return;
    reset({
      date: today(),
      investmentOption: GOLD_INVESTMENT_OPTIONS[0].value,
      schemeName: "",
      holdingId: initialHoldingId || holdings[0]?.id || "",
      investedAmount: "",
      currentValue: "",
      sellAmount: "",
      units: "",
    });
  }, [kind, initialHoldingId, holdings, reset]);

  const watchedOption = useWatch({ control, name: "investmentOption" });
  const isSgb = kind === "buy" && watchedOption === "sovereign_gold_bond";
  const [bonds, setBonds] = useState<Array<{ symbol: string; lastPrice: number }>>([]);

  // NSE-listed SGB series with live prices, for picking the series code.
  useEffect(() => {
    if (!isSgb || bonds.length) return;
    fetch("/api/gold/sgb", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => setBonds(result?.bonds || []))
      .catch(() => null);
  }, [isSgb, bonds.length]);

  const watchedScheme = useWatch({ control, name: "schemeName" });
  const watchedUnits = useWatch({ control, name: "units" });
  const bondPrice = bonds.find((bond) => bond.symbol === String(watchedScheme || "").trim().toUpperCase())?.lastPrice;

  const watchedHoldingId = useWatch({ control, name: "holdingId" });
  const selectedHolding = holdings.find((holding) => holding.id === watchedHoldingId);
  const copy = kind ? TITLES[kind] : TITLES.buy;

  async function submit(values: Values) {
    if (!kind) return;

    if (kind === "buy") {
      await onSave({
        transactionType: "buy",
        investmentOption: values.investmentOption,
        schemeName: values.schemeName,
        investedAmount: Number(values.investedAmount),
        currentValue: Number(values.currentValue),
        ...(values.investmentOption === "sovereign_gold_bond" ? { units: Number(values.units) } : {}),
        date: values.date,
      });
      return;
    }

    const holding = holdings.find((entry) => entry.id === values.holdingId);

    if (!holding) {
      setError("holdingId", { message: "Please choose a holding." });
      return;
    }

    if (kind === "sell") {
      const sellAmount = Number(values.sellAmount);

      if (sellAmount > holding.currentValue) {
        setError("sellAmount", { message: "Sell amount cannot exceed the holding current value." });
        return;
      }

      await onSave({
        transactionType: "sell",
        investmentOption: holding.investmentOption,
        schemeName: holding.schemeName,
        sellAmount,
        date: values.date,
      });
      return;
    }

    await onSave({
      transactionType: "valuation",
      investmentOption: holding.investmentOption,
      schemeName: holding.schemeName,
      currentValue: Number(values.currentValue),
      date: values.date,
    });
  }

  const positive = (label: string) => (value: string) => Number(value) > 0 || `${label} must be greater than zero.`;

  const holdingField = (
    <Field label="Holding" error={errors.holdingId?.message}>
      <Select {...register("holdingId", { required: "Please choose a holding." })}>
        {holdings.map((holding) => (
          <option key={holding.id} value={holding.id}>
            {holding.schemeName} · {holding.investmentOptionLabel}
          </option>
        ))}
      </Select>
    </Field>
  );

  const dateField = (label: string) => (
    <Field label={label} error={errors.date?.message}>
      <Input type="date" max={today()} {...register("date", { required: "Date is required." })} />
    </Field>
  );

  return (
    <Sheet
      open={kind !== null}
      onClose={onClose}
      title={copy.title}
      description={copy.description}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="gold-form" loading={isSubmitting}>
            {copy.submit}
          </Button>
        </div>
      }
    >
      <form id="gold-form" className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        {kind === "buy" ? (
          <>
            <Field label="Investment type" error={errors.investmentOption?.message}>
              <Select {...register("investmentOption", { required: "Investment option is required." })}>
                {GOLD_INVESTMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Fund, scheme or asset name"
              error={errors.schemeName?.message}
              hint="For SGBs use the series code, e.g. SGBMAY29I, so prices can be auto-tracked."
            >
              <Input
                placeholder="SGBMAY29I"
                list={isSgb ? "nse-sgb-series" : undefined}
                {...register("schemeName", {
                  required: "Fund or scheme name is required.",
                  maxLength: { value: 220, message: "Name must be 220 characters or fewer." },
                })}
              />
              {isSgb ? (
                <datalist id="nse-sgb-series">
                  {bonds.map((bond) => (
                    <option key={bond.symbol} value={bond.symbol}>
                      {formatMoney(bond.lastPrice, { currency })}
                    </option>
                  ))}
                </datalist>
              ) : null}
            </Field>
            {isSgb ? (
              <Field
                label="Units (grams)"
                error={errors.units?.message}
                hint={
                  bondPrice
                    ? `NSE price ${formatMoney(bondPrice, { currency })} per unit — value updates automatically every morning.`
                    : "Needed so the bond is priced automatically from NSE every morning."
                }
              >
                <Input
                  type="number"
                  step="1"
                  inputMode="numeric"
                  placeholder="10"
                  {...register("units", {
                    validate: (value) => (isSgb && !(Number(value) > 0) ? "Units must be greater than zero." : true),
                  })}
                />
              </Field>
            ) : null}
            <FieldGrid>
              <Field label="Invested amount" error={errors.investedAmount?.message}>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="50000"
                  {...register("investedAmount", {
                    required: "Invested amount is required.",
                    validate: positive("Invested amount"),
                  })}
                />
              </Field>
              <Field label="Current value" error={errors.currentValue?.message}>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder={bondPrice && Number(watchedUnits) > 0 ? String(Math.round(bondPrice * Number(watchedUnits))) : "52000"}
                  {...register("currentValue", {
                    required: "Current value is required.",
                    validate: positive("Current value"),
                  })}
                />
              </Field>
            </FieldGrid>
            {dateField("Purchase date")}
          </>
        ) : null}

        {kind === "sell" ? (
          <>
            {holdingField}
            <Field
              label="Sell amount"
              error={errors.sellAmount?.message}
              hint={selectedHolding ? `Up to ${formatMoney(selectedHolding.currentValue, { currency })}` : undefined}
            >
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="10000"
                {...register("sellAmount", {
                  required: "Sell amount is required.",
                  validate: positive("Sell amount"),
                })}
              />
            </Field>
            {dateField("Sell date")}
          </>
        ) : null}

        {kind === "valuation" ? (
          <>
            {holdingField}
            <Field
              label="New current value"
              error={errors.currentValue?.message}
              hint={selectedHolding ? `Last value ${formatMoney(selectedHolding.currentValue, { currency })}` : undefined}
            >
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="56000"
                {...register("currentValue", {
                  required: "Current value is required.",
                  validate: positive("Current value"),
                })}
              />
            </Field>
            {dateField("Valuation date")}
          </>
        ) : null}
      </form>
    </Sheet>
  );
}
