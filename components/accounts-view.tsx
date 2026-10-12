"use client";

import { useState, type FormEvent } from "react";
import {
  Banknote,
  Building2,
  CreditCard,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";

import { Sparkline } from "@/components/ui/charts";
import { Field, FieldGrid, Input, Select, Sheet, Textarea } from "@/components/ui/sheet";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Delta,
  EmptyState,
  IconButton,
  Page,
  ProgressBar,
  Segmented,
  StatTile,
} from "@/components/ui/kit";
import {
  ASSET_ACCOUNT_CATEGORIES,
  LIABILITY_ACCOUNT_CATEGORIES,
  type AccountCategory,
  type AccountKind,
  type AccountsDashboardData,
  type AccountSummary,
  type SaveAccountInput,
} from "@/lib/accounts.types";
import { formatCompactMoney, formatDate, formatMoney, formatPercent, formatRelativeTime } from "@/lib/format";

type FormState = {
  id: string | null;
  kind: AccountKind;
  category: AccountCategory;
  name: string;
  institution: string;
  currentValue: string;
  baseAmount: string;
  interestRate: string;
  monthlyPayment: string;
  maturityDate: string;
  note: string;
};

const BLANK_FORM: FormState = {
  id: null,
  kind: "asset",
  category: "fixed_deposit",
  name: "",
  institution: "",
  currentValue: "",
  baseAmount: "",
  interestRate: "",
  monthlyPayment: "",
  maturityDate: "",
  note: "",
};

const CATEGORY_ICONS: Partial<Record<AccountCategory, typeof Landmark>> = {
  fixed_deposit: Landmark,
  ppf: ShieldCheck,
  epf: ShieldCheck,
  nps: PiggyBank,
  bonds: Banknote,
  real_estate: Building2,
  crypto: TrendingUp,
  credit_card: CreditCard,
};

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formFromAccount(account: AccountSummary): FormState {
  return {
    id: account.id,
    kind: account.kind,
    category: account.category,
    name: account.name,
    institution: account.institution,
    currentValue: String(account.currentValue),
    baseAmount: account.baseAmount == null ? "" : String(account.baseAmount),
    interestRate: account.interestRate == null ? "" : String(account.interestRate),
    monthlyPayment: account.monthlyPayment == null ? "" : String(account.monthlyPayment),
    maturityDate: account.maturityDate ? account.maturityDate.slice(0, 10) : "",
    note: account.note,
  };
}

function toPayload(account: AccountSummary, currentValue: number): SaveAccountInput {
  return {
    kind: account.kind,
    category: account.category,
    name: account.name,
    institution: account.institution,
    currentValue,
    baseAmount: account.baseAmount,
    interestRate: account.interestRate,
    monthlyPayment: account.monthlyPayment,
    maturityDate: account.maturityDate ? account.maturityDate.slice(0, 10) : null,
    note: account.note,
  };
}

export function AccountsView({ data, currencyCode }: { data: AccountsDashboardData; currencyCode: string }) {
  const currency = currencyCode;
  const [dashboard, setDashboard] = useState(data);
  const [syncedProps, setSyncedProps] = useState(data);
  const [form, setForm] = useState<FormState | null>(null);
  const [valueTarget, setValueTarget] = useState<AccountSummary | null>(null);
  const [valueInput, setValueInput] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AccountSummary | null>(null);
  const [busy, setBusy] = useState(false);

  if (data !== syncedProps) {
    setSyncedProps(data);
    setDashboard(data);
  }

  const total = dashboard.assets.length + dashboard.liabilities.length;
  const debtRatio = dashboard.totalAssets > 0 ? (dashboard.totalLiabilities / dashboard.totalAssets) * 100 : null;

  async function request(method: "POST" | "PATCH" | "DELETE", body: unknown, query = "") {
    setBusy(true);

    try {
      const response = await fetch(`/api/accounts${query}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await response.json().catch(() => null)) as
        | { dashboard?: AccountsDashboardData; message?: string }
        | null;

      if (!response.ok || !result?.dashboard) {
        throw new Error(result?.message || "Something went wrong. Please try again.");
      }

      setDashboard(result.dashboard);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form) return;

    const currentValue = toNumberOrNull(form.currentValue);

    if (currentValue == null || currentValue < 0) {
      toast.error(form.kind === "asset" ? "Enter the current value." : "Enter the outstanding amount.");
      return;
    }

    const payload: SaveAccountInput = {
      kind: form.kind,
      category: form.category,
      name: form.name.trim(),
      institution: form.institution.trim(),
      currentValue,
      baseAmount: toNumberOrNull(form.baseAmount),
      interestRate: toNumberOrNull(form.interestRate),
      monthlyPayment: toNumberOrNull(form.monthlyPayment),
      maturityDate: form.maturityDate || null,
      note: form.note.trim(),
    };
    const ok = await request(form.id ? "PATCH" : "POST", form.id ? { ...payload, id: form.id } : payload);

    if (ok) {
      toast.success(form.id ? "Account updated." : "Account added.");
      setForm(null);
    }
  }

  async function handleValueUpdate(event: FormEvent) {
    event.preventDefault();
    if (!valueTarget) return;

    const next = toNumberOrNull(valueInput);

    if (next == null || next < 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    if (await request("PATCH", { ...toPayload(valueTarget, next), id: valueTarget.id })) {
      toast.success("Value updated.");
      setValueTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    if (await request("DELETE", null, `?id=${encodeURIComponent(deleteTarget.id)}`)) {
      toast.success("Account removed.");
      setDeleteTarget(null);
    }
  }

  function openAdd(kind: AccountKind) {
    setForm({
      ...BLANK_FORM,
      kind,
      category: kind === "asset" ? ASSET_ACCOUNT_CATEGORIES[0].value : LIABILITY_ACCOUNT_CATEGORIES[0].value,
    });
  }

  function openUpdateValue(account: AccountSummary) {
    setValueTarget(account);
    setValueInput(String(account.currentValue));
  }

  const addActions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" icon={Plus} onClick={() => openAdd("asset")}>Add asset</Button>
      <Button icon={Plus} onClick={() => openAdd("liability")}>Add loan / liability</Button>
    </div>
  );

  return (
    <Page>
      {total === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title="Complete your net worth"
            message="Stocks, funds, gold and cash are tracked automatically. Add what is outside them so the number on your dashboard is the real one."
            action={addActions}
          />
          <div className="mx-auto mt-2 grid max-w-3xl gap-3 pb-4 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "EPF, PPF & NPS", text: "For many people these are the largest savings of all, yet they never show up in a broker or fund app." },
              { icon: Landmark, title: "Fixed deposits & bonds", text: "Track principal, interest rate and maturity so you know what is locked in and when it frees up." },
              { icon: CreditCard, title: "Loans & credit cards", text: "Net worth is what you own minus what you owe. A home loan can outweigh every investment you hold." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl bg-surface-2 p-3.5">
                <item.icon className="size-5 text-brand" aria-hidden />
                <p className="mt-2 text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-3">{item.text}</p>
              </div>
            ))}
          </div>
          <p className="pb-2 text-center text-xs text-ink-3">
            Once added, these flow into your net worth and daily history automatically. Update a balance any time in two taps.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-3">Other assets, net of loans</p>
                <p className="tabular mt-1 text-[2.1rem] leading-tight font-semibold tracking-tight text-ink sm:text-[2.6rem]">
                  {formatMoney(dashboard.netValue, { currency, decimals: 0 })}
                </p>
                <p className="mt-1 text-sm text-ink-3">
                  {formatMoney(dashboard.totalAssets, { currency, decimals: 0 })} assets minus{" "}
                  {formatMoney(dashboard.totalLiabilities, { currency, decimals: 0 })} owed
                </p>
              </div>
              {addActions}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Other assets" value={formatCompactMoney(dashboard.totalAssets, { currency })} caption={`${dashboard.assets.length} accounts`} />
              <StatTile label="Liabilities" value={formatCompactMoney(dashboard.totalLiabilities, { currency })} caption={`${dashboard.liabilities.length} loans & cards`} />
              <StatTile
                label="Monthly EMI"
                value={formatCompactMoney(dashboard.totalMonthlyPayments, { currency })}
                caption="Total outgo each month"
              />
              <StatTile
                label="Debt-to-asset"
                value={debtRatio == null ? "—" : formatPercent(debtRatio, { decimals: 0 })}
                caption={
                  debtRatio == null
                    ? "Add assets to compare"
                    : debtRatio < 30
                      ? "Comfortable on these accounts"
                      : debtRatio < 60
                        ? "Moderate. Keep an eye on it"
                        : "High versus tracked assets"
                }
              />
            </div>
          </Card>

          <AccountSection
            title="Other assets"
            subtitle="FDs, provident funds, NPS, bonds, property and crypto"
            accounts={dashboard.assets}
            currency={currency}
            emptyText="No other assets yet. EPF, PPF and fixed deposits are a good start."
            onAdd={() => openAdd("asset")}
            onEdit={(account) => setForm(formFromAccount(account))}
            onUpdateValue={openUpdateValue}
            onDelete={setDeleteTarget}
          />
          <AccountSection
            title="Liabilities"
            subtitle="Loans and credit cards, shown by what is still outstanding"
            accounts={dashboard.liabilities}
            currency={currency}
            emptyText="No loans or cards recorded. Add them so net worth reflects what you owe."
            onAdd={() => openAdd("liability")}
            onEdit={(account) => setForm(formFromAccount(account))}
            onUpdateValue={openUpdateValue}
            onDelete={setDeleteTarget}
          />
        </>
      )}

      <Sheet
        open={form != null}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit account" : form?.kind === "liability" ? "Add loan or liability" : "Add asset"}
        description="Values are entered by you; update them whenever the balance changes."
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setForm(null)}>Cancel</Button>
            <Button type="submit" form="account-form" variant="primary" loading={busy}>
              {form?.id ? "Save changes" : "Add"}
            </Button>
          </div>
        }
      >
        {form ? (
          <form id="account-form" onSubmit={handleSave} className="space-y-4">
            {!form.id ? (
              <Segmented
                ariaLabel="Account type"
                value={form.kind}
                onChange={(kind) =>
                  setForm({
                    ...form,
                    kind,
                    category: kind === "asset" ? ASSET_ACCOUNT_CATEGORIES[0].value : LIABILITY_ACCOUNT_CATEGORIES[0].value,
                  })
                }
                options={[
                  { value: "asset", label: "Asset" },
                  { value: "liability", label: "Liability" },
                ]}
              />
            ) : null}
            <FieldGrid>
              <Field label="Category">
                <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as AccountCategory })}>
                  {(form.kind === "asset" ? ASSET_ACCOUNT_CATEGORIES : LIABILITY_ACCOUNT_CATEGORIES).map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Name">
                <Input required minLength={2} placeholder={form.kind === "asset" ? "e.g. HDFC 1-yr FD" : "e.g. Home loan"} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Institution" hint="Optional">
                <Input placeholder="Bank / provider" value={form.institution} onChange={(event) => setForm({ ...form, institution: event.target.value })} />
              </Field>
              <Field label={form.kind === "asset" ? "Current value" : "Outstanding"}>
                <Input required type="number" inputMode="decimal" min="0" step="any" value={form.currentValue} onChange={(event) => setForm({ ...form, currentValue: event.target.value })} />
              </Field>
              <Field label={form.kind === "asset" ? "Principal invested" : "Original loan amount"} hint="Optional">
                <Input type="number" inputMode="decimal" min="0" step="any" value={form.baseAmount} onChange={(event) => setForm({ ...form, baseAmount: event.target.value })} />
              </Field>
              <Field label="Interest rate (% p.a.)" hint="Optional">
                <Input type="number" inputMode="decimal" min="0" max="100" step="any" value={form.interestRate} onChange={(event) => setForm({ ...form, interestRate: event.target.value })} />
              </Field>
              <Field label={form.kind === "asset" ? "Monthly contribution" : "Monthly EMI"} hint="Optional">
                <Input type="number" inputMode="decimal" min="0" step="any" value={form.monthlyPayment} onChange={(event) => setForm({ ...form, monthlyPayment: event.target.value })} />
              </Field>
              <Field label={form.kind === "asset" ? "Maturity date" : "Loan end date"} hint="Optional">
                <Input type="date" value={form.maturityDate} onChange={(event) => setForm({ ...form, maturityDate: event.target.value })} />
              </Field>
            </FieldGrid>
            <Field label="Note" hint="Optional">
              <Textarea maxLength={300} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </Field>
          </form>
        ) : null}
      </Sheet>

      <Sheet
        open={valueTarget != null}
        onClose={() => setValueTarget(null)}
        size="sm"
        title={valueTarget ? `Update ${valueTarget.kind === "asset" ? "value" : "outstanding"}` : ""}
        description={valueTarget?.name}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setValueTarget(null)}>Cancel</Button>
            <Button type="submit" form="value-form" variant="primary" loading={busy}>Update</Button>
          </div>
        }
      >
        <form id="value-form" onSubmit={handleValueUpdate}>
          <Field label={valueTarget?.kind === "asset" ? "Current value" : "Outstanding"}>
            <Input required type="number" inputMode="decimal" min="0" step="any" value={valueInput} onChange={(event) => setValueInput(event.target.value)} />
          </Field>
        </form>
      </Sheet>

      <Sheet
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        title="Remove this account?"
        description={deleteTarget ? `${deleteTarget.name} will be removed from your net worth. This cannot be undone.` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDeleteTarget(null)}>Keep</Button>
            <Button variant="danger" loading={busy} onClick={handleDelete}>Remove</Button>
          </div>
        }
      >
        <></>
      </Sheet>
    </Page>
  );
}

function AccountSection({
  title,
  subtitle,
  accounts,
  currency,
  emptyText,
  onAdd,
  onEdit,
  onUpdateValue,
  onDelete,
}: {
  title: string;
  subtitle: string;
  accounts: AccountSummary[];
  currency: string;
  emptyText: string;
  onAdd: () => void;
  onEdit: (account: AccountSummary) => void;
  onUpdateValue: (account: AccountSummary) => void;
  onDelete: (account: AccountSummary) => void;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={<Button size="sm" icon={Plus} onClick={onAdd}>Add</Button>}
      />
      {accounts.length === 0 ? (
        <EmptyState title={emptyText} className="py-6" />
      ) : (
        <ul className="divide-y divide-line">
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} currency={currency} onEdit={onEdit} onUpdateValue={onUpdateValue} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function AccountRow({
  account,
  currency,
  onEdit,
  onUpdateValue,
  onDelete,
}: {
  account: AccountSummary;
  currency: string;
  onEdit: (account: AccountSummary) => void;
  onUpdateValue: (account: AccountSummary) => void;
  onDelete: (account: AccountSummary) => void;
}) {
  const Icon = CATEGORY_ICONS[account.category] || Landmark;
  const isLiability = account.kind === "liability";
  const gain = !isLiability && account.baseAmount ? account.currentValue - account.baseAmount : null;
  const repaidPct =
    isLiability && account.baseAmount && account.baseAmount > 0
      ? Math.max(0, Math.min(100, ((account.baseAmount - account.currentValue) / account.baseAmount) * 100))
      : null;
  const sparkValues = account.history.map((point) => point.value);
  const details: { label: string; value: string }[] = [
    account.baseAmount != null ? { label: isLiability ? "Original" : "Invested", value: formatMoney(account.baseAmount, { currency, decimals: 0 }) } : null,
    account.interestRate != null ? { label: "Rate", value: `${formatPercent(account.interestRate, { decimals: 2 })} p.a.` } : null,
    account.monthlyPayment != null ? { label: isLiability ? "EMI" : "Monthly", value: formatMoney(account.monthlyPayment, { currency, decimals: 0 }) } : null,
    account.maturityDate ? { label: isLiability ? "Ends" : "Matures", value: formatDate(account.maturityDate) } : null,
  ].filter((item): item is { label: string; value: string } => item != null);

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
          <Icon className="size-[1.15rem]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{account.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge tone={isLiability ? "warn" : "brand"}>{account.categoryLabel}</Badge>
                {account.institution ? <span className="truncate text-xs text-ink-3">{account.institution}</span> : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className={`tabular text-base font-semibold ${isLiability ? "text-loss" : "text-ink"}`}>
                {isLiability ? "−" : ""}
                {formatMoney(account.currentValue, { currency, decimals: 0 })}
              </p>
              <p className="text-xs text-ink-3">{isLiability ? "Outstanding" : "Current value"}</p>
              {gain != null ? <Delta value={gain} compact currency={currency} size="xs" /> : null}
            </div>
          </div>

          {details.length > 0 || sparkValues.length > 1 ? (
            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <dl className="flex flex-wrap gap-x-5 gap-y-1.5">
                {details.map((item) => (
                  <div key={item.label}>
                    <dt className="text-[0.7rem] text-ink-3">{item.label}</dt>
                    <dd className="tabular text-xs font-medium text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
              {sparkValues.length > 1 ? <Sparkline values={sparkValues} width={96} height={28} /> : null}
            </div>
          ) : null}

          {repaidPct != null ? (
            <div className="mt-3">
              <ProgressBar value={repaidPct} tone="gain" label="Repaid" />
              <p className="mt-1 text-xs text-ink-3">{formatPercent(repaidPct, { decimals: 0 })} repaid</p>
            </div>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-3">Updated {formatRelativeTime(account.valueUpdatedAt)}</p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => onUpdateValue(account)}>Update value</Button>
              <IconButton icon={Pencil} label={`Edit ${account.name}`} onClick={() => onEdit(account)} />
              <IconButton icon={Trash2} label={`Remove ${account.name}`} onClick={() => onDelete(account)} />
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
