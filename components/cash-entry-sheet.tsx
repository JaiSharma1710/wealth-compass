"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Field, FieldGrid, Input, Select, Sheet, Textarea } from "@/components/ui/sheet";
import { Button, Segmented } from "@/components/ui/kit";
import type { CashReserveEntrySummary } from "@/lib/cash-reserves.types";

export type CashEntryKind = "credit" | "debit" | "transfer";

export type CashEntrySubmit = {
  entryType: CashEntryKind;
  bank: string;
  toBank: string;
  amount: string;
  date: string;
  note: string;
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Add / edit sheet for a cash entry. Remount (via key) to reset the form. */
export function CashEntrySheet({
  open,
  onClose,
  banks,
  entry,
  saving,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  banks: string[];
  entry: CashReserveEntrySummary | null;
  saving: boolean;
  onSubmit: (values: CashEntrySubmit) => void;
  onDelete?: () => void;
}) {
  const [values, setValues] = useState<CashEntrySubmit>(() => ({
    entryType: entry?.entryType ?? "credit",
    bank: entry?.bank ?? banks[0] ?? "",
    toBank: banks.find((bank) => bank !== (entry?.bank ?? banks[0])) ?? "",
    amount: entry ? String(entry.amount) : "",
    date: entry?.dateKey ?? todayKey(),
    note: entry?.note ?? "",
  }));
  const set = <K extends keyof CashEntrySubmit>(key: K, value: CashEntrySubmit[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const editing = Boolean(entry);
  const transfer = values.entryType === "transfer";
  const bankOptions = entry && !banks.includes(entry.bank) ? [entry.bank, ...banks] : banks;
  const valid =
    Number(values.amount) > 0 && values.bank && (!transfer || (values.toBank && values.toBank !== values.bank));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit entry" : "Add cash entry"}
      description={
        editing
          ? "Changes are blocked if they would leave any bank below zero at any date."
          : "Record money in or out of a bank account, or move it between banks."
      }
      footer={
        <div className="flex w-full items-center gap-2">
          {editing && onDelete ? (
            <Button variant="danger" icon={Trash2} onClick={onDelete} disabled={saving}>
              Delete
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="primary" loading={saving} disabled={!valid} onClick={() => onSubmit(values)}>
              {editing ? "Save changes" : transfer ? "Transfer" : "Add entry"}
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !saving) onSubmit(values);
        }}
      >
        <Segmented
          ariaLabel="Entry type"
          value={values.entryType}
          onChange={(value) => set("entryType", value)}
          options={[
            { value: "credit", label: "Credit (in)" },
            { value: "debit", label: "Debit (out)" },
            ...(editing ? [] : [{ value: "transfer" as const, label: "Transfer" }]),
          ]}
        />
        <FieldGrid>
          <Field label={transfer ? "From bank" : "Bank"}>
            <Select value={values.bank} onChange={(event) => set("bank", event.target.value)} required>
              {bankOptions.map((bank) => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </Select>
          </Field>
          {transfer ? (
            <Field label="To bank">
              <Select value={values.toBank} onChange={(event) => set("toBank", event.target.value)} required>
                {banks.filter((bank) => bank !== values.bank).map((bank) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Amount">
            <Input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={values.amount}
              onChange={(event) => set("amount", event.target.value)}
              required
            />
          </Field>
          <Field label="Date">
            <Input type="date" max={todayKey()} value={values.date} onChange={(event) => set("date", event.target.value)} required />
          </Field>
        </FieldGrid>
        <Field label="Note (optional)">
          <Textarea
            maxLength={500}
            placeholder={transfer ? "e.g. Moving savings" : "e.g. Salary, rent, refund"}
            value={values.note}
            onChange={(event) => set("note", event.target.value)}
          />
        </Field>
      </form>
    </Sheet>
  );
}
