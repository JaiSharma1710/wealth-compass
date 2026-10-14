"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  RefreshCw,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";

import { AllocationBar, ASSET_COLORS, ColumnChart, RankedBars, SERIES_COLORS } from "@/components/ui/charts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Page,
  ProgressBar,
  Skeleton,
  StatTile,
} from "@/components/ui/kit";
import { Field, FieldGrid, Input, Select, Sheet } from "@/components/ui/sheet";
import type {
  AdvisorMetrics,
  AdvisorProfile,
  AdvisorReport,
  AdvisorSectionAdvice,
  AdvisorSectionKey,
} from "@/lib/advisor.types";
import { formatCompactMoney, formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const SECTION_TITLES: Record<AdvisorSectionKey, string> = {
  investments: "Investments",
  spending: "Spending",
  debt: "Debt",
  cash: "Cash & emergency fund",
  goals: "Goals",
};

const ALLOCATION_LABELS: Record<string, string> = {
  stocks: "Stocks",
  mutualFunds: "Mutual Funds",
  gold: "Gold",
  cash: "Cash",
  otherAssets: "Other",
};

function scoreTone(score: number) {
  return score >= 75 ? "gain" : score >= 50 ? "warn" : "loss";
}

function scoreLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  return "Needs work";
}

export function AdvisorView({
  metrics,
  profile: initialProfile,
  currencyCode,
  aiEnabled,
}: {
  metrics: AdvisorMetrics;
  profile: AdvisorProfile;
  currencyCode: string;
  aiEnabled: boolean;
}) {
  const currency = currencyCode;
  const [report, setReport] = useState<AdvisorReport | null>(null);
  const [error, setError] = useState<string | null>(aiEnabled ? null : "Add GEMINI_API_KEY to enable AI analysis.");
  const [loading, setLoading] = useState(aiEnabled);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (method: "GET" | "POST") => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/advisor", { method, cache: "no-store" });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.report) throw new Error(result?.message || "Unable to generate advice.");

      setReport(result.report);
      setNow(Date.now());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to generate advice.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!aiEnabled) return;
    const timer = window.setTimeout(() => void load("GET"), 0);
    return () => window.clearTimeout(timer);
  }, [aiEnabled, load]);

  const advice = report?.advice;
  const canRefresh = report ? now >= new Date(report.nextRefreshAt).getTime() : true;
  const sectionAdvice = (key: AdvisorSectionKey) => advice?.sections.find((section) => section.key === key) || null;
  const tone = scoreTone(metrics.healthScore);

  return (
    <Page>
      <Card>
        <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex items-center gap-4">
            <ScoreRing score={metrics.healthScore} />
            <div>
              <p className="text-sm font-medium text-ink-3">Financial health</p>
              <p className="text-2xl font-semibold text-ink">{scoreLabel(metrics.healthScore)}</p>
              <Badge tone={tone} className="mt-1">
                {metrics.scores.length} checks
              </Badge>
            </div>
          </div>
          <div className="min-w-0 lg:border-l lg:border-line lg:pl-6">
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand">
              <Sparkles className="size-3.5" /> AI advisor
            </div>
            {loading && !advice ? (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <p className="text-xs text-ink-3">Analysing your portfolio, spending and goals…</p>
              </div>
            ) : advice ? (
              <>
                <h2 className="mt-1 text-lg font-semibold text-ink sm:text-xl">{advice.headline}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{advice.verdict}</p>
              </>
            ) : (
              <p className="mt-2 flex items-start gap-2 text-sm text-ink-2">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" /> {error}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {aiEnabled ? (
                <Button
                  size="sm"
                  icon={RefreshCw}
                  loading={loading}
                  disabled={!canRefresh}
                  title={canRefresh ? undefined : `Available after ${formatDateTime(report?.nextRefreshAt)}`}
                  onClick={() => void load("POST")}
                >
                  Re-analyse
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" icon={UserRound} onClick={() => setProfileOpen(true)}>
                {profile.monthlyIncome ? `Income ${formatCompactMoney(profile.monthlyIncome, { currency })}/mo` : "Add income"} ·{" "}
                <span className="capitalize">{profile.riskProfile}</span>
              </Button>
              {report ? (
                <span className="text-xs text-ink-3">Analysed {formatDateTime(report.generatedAt)}</span>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {metrics.monthlyIncome == null ? (
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-brand/25 bg-brand-soft px-4 py-3 text-left text-sm text-brand-ink"
        >
          <Wallet className="size-4 shrink-0" />
          Add your monthly take-home income to unlock savings rate, EMI burden and a monthly money plan.
        </button>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Emergency fund"
          value={metrics.emergencyMonths == null ? "—" : `${metrics.emergencyMonths} mo`}
          caption="Target: 6 months"
        />
        <StatTile
          label="Savings rate"
          value={metrics.savingsRate == null ? "—" : formatPercent(metrics.savingsRate, { decimals: 0 })}
          caption={metrics.monthlySurplus == null ? "Needs income" : `${formatCompactMoney(metrics.monthlySurplus, { currency })}/mo surplus`}
        />
        <StatTile
          label="EMI burden"
          value={metrics.emiToIncome == null ? formatCompactMoney(metrics.monthlyEmi, { currency }) : formatPercent(metrics.emiToIncome, { decimals: 0 })}
          caption={metrics.emiToIncome == null ? "EMIs per month" : "of income · keep under 30%"}
        />
        <StatTile
          label="Debt to assets"
          value={formatPercent(metrics.debtToAssets, { decimals: 0 })}
          caption={`${formatCompactMoney(metrics.totalLiabilities, { currency })} owed`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Score breakdown" subtitle="Calculated from your data — not by AI" />
          <ul className="space-y-4">
            {metrics.scores.map((score) => (
              <li key={score.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{score.label}</span>
                  <span className="tabular font-semibold text-ink">{score.score}</span>
                </div>
                <ProgressBar value={score.score} tone={scoreTone(score.score)} label={score.label} />
                <p className="mt-1 text-xs text-ink-3">{score.detail}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Your action plan" subtitle="Most impactful first" />
          {advice ? (
            <ol className="space-y-3">
              {[...advice.actions]
                .sort((left, right) => left.priority - right.priority)
                .map((action, index) => (
                  <li key={`${action.title}-${index}`} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-cta text-xs font-semibold text-cta-ink">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{action.title}</p>
                      <p className="mt-0.5 text-sm text-ink-2">{action.detail}</p>
                      <p className="mt-1 text-xs font-medium text-gain">{action.impact}</p>
                    </div>
                  </li>
                ))}
            </ol>
          ) : (
            <AiPlaceholder loading={loading} error={error} />
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Where your money should flow"
            subtitle={advice ? `${formatMoney(advice.moneyFlow.monthlyAmount, { currency })} a month` : "Monthly plan"}
          />
          {advice ? (
            <>
              <AllocationBar
                currency={currency}
                showList={false}
                items={advice.moneyFlow.allocations.map((allocation, index) => ({
                  key: `${allocation.label}-${index}`,
                  label: allocation.label,
                  value: allocation.amount,
                  color: SERIES_COLORS[index % SERIES_COLORS.length],
                }))}
              />
              <ul className="mt-4 space-y-3">
                {advice.moneyFlow.allocations.map((allocation, index) => (
                  <li key={`${allocation.label}-${index}`} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-1.5 size-2.5 shrink-0 rounded-[3px]"
                      style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-ink">{allocation.label}</span>
                        <span className="tabular text-sm font-semibold text-ink">{formatMoney(allocation.amount, { currency })}</span>
                      </div>
                      <p className="text-xs text-ink-3">{allocation.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-3">{advice.moneyFlow.basis}</p>
            </>
          ) : (
            <AiPlaceholder loading={loading} error={error} />
          )}
        </Card>

        <Card>
          <CardHeader title="Asset mix: now vs suggested" subtitle={`For a ${profile.riskProfile} investor${profile.age ? `, age ${profile.age}` : ""}`} />
          {advice?.targetAllocation?.length ? (
            <ColumnChart
              height={230}
              xKey="label"
              valueFormatter={(value) => formatPercent(value, { decimals: 0 })}
              data={Object.keys(ALLOCATION_LABELS).map((key) => ({
                label: ALLOCATION_LABELS[key],
                current: metrics.allocation.find((item) => item.key === key)?.percent || 0,
                suggested: advice.targetAllocation.find((item) => item.key === key)?.percent || 0,
              }))}
              series={[
                { key: "current", label: "Now", color: "var(--wc-ink-3)" },
                { key: "suggested", label: "Suggested", color: "var(--wc-brand)" },
              ]}
            />
          ) : (
            <AiPlaceholder loading={loading} error={error} />
          )}
        </Card>
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold text-ink-2">Areas of focus</h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SectionCard title={SECTION_TITLES.investments} advice={sectionAdvice("investments")} loading={loading}>
          <AllocationBar
            currency={currency}
            showList={false}
            items={metrics.allocation.map((item) => ({
              key: item.key,
              label: item.label,
              value: item.value,
              color: ASSET_COLORS[item.key as keyof typeof ASSET_COLORS] || "var(--wc-ink-3)",
            }))}
          />
          <p className="mt-2 text-xs text-ink-3">
            Equity {formatPercent(metrics.equityPercent, { decimals: 0 })} · stocks {formatPercent(metrics.stocks.returnsPercent, { sign: true, decimals: 1 })} · funds{" "}
            {formatPercent(metrics.funds.returnsPercent, { sign: true, decimals: 1 })}
          </p>
        </SectionCard>

        <SectionCard title={SECTION_TITLES.spending} advice={sectionAdvice("spending")} loading={loading}>
          {metrics.spending.topCategories.length ? (
            <RankedBars
              currency={currency}
              color="var(--wc-asset-funds)"
              items={metrics.spending.topCategories.map((category) => ({ key: category.label, label: category.label, value: category.amount }))}
            />
          ) : (
            <p className="text-xs text-ink-3">No spending logged this cycle.</p>
          )}
        </SectionCard>

        <SectionCard title={SECTION_TITLES.debt} advice={sectionAdvice("debt")} loading={loading}>
          {metrics.debt.length ? (
            <RankedBars
              currency={currency}
              color="var(--wc-loss)"
              items={metrics.debt.map((loan) => ({
                key: loan.name,
                label: loan.name,
                value: loan.outstanding,
                caption: loan.annualRate != null ? `${loan.annualRate}%` : undefined,
              }))}
            />
          ) : (
            <p className="text-xs text-ink-3">Debt-free.</p>
          )}
        </SectionCard>

        <SectionCard title={SECTION_TITLES.cash} advice={sectionAdvice("cash")} loading={loading}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink-3">Covered</span>
            <span className="tabular font-semibold text-ink">{metrics.emergencyMonths ?? "—"} / 6 months</span>
          </div>
          <ProgressBar
            className="mt-1.5"
            value={((metrics.emergencyMonths || 0) / 6) * 100}
            tone={(metrics.emergencyMonths || 0) >= 6 ? "gain" : (metrics.emergencyMonths || 0) >= 3 ? "warn" : "loss"}
            label="Emergency fund coverage"
          />
        </SectionCard>

        <SectionCard title={SECTION_TITLES.goals} advice={sectionAdvice("goals")} loading={loading}>
          {metrics.goals.length ? (
            <ul className="space-y-2.5">
              {metrics.goals.slice(0, 3).map((goal) => (
                <li key={goal.name}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-ink-2">{goal.name}</span>
                    <span className="tabular text-ink-3">{formatPercent(goal.progressPct, { decimals: 0 })}</span>
                  </div>
                  <ProgressBar value={goal.progressPct} tone={goal.status === "behind" || goal.status === "overdue" ? "warn" : "brand"} label={goal.name} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-3">No goals yet.</p>
          )}
        </SectionCard>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-3">
        Numbers and scores are calculated from your own data. Commentary is generated by {report?.model || "Google Gemini"} from those
        numbers and can be wrong. It is educational guidance, not advice from a SEBI-registered investment adviser.
      </p>

      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        onSaved={(next) => {
          setProfile(next);
          window.location.reload();
        }}
      />
    </Page>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const tone = scoreTone(score);

  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--wc-surface-3)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={`var(--wc-${tone})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-2xl font-semibold text-ink">{score}</span>
        <span className="text-[0.65rem] text-ink-3">/ 100</span>
      </div>
    </div>
  );
}

function AiPlaceholder({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  return <EmptyState icon={Sparkles} title="AI analysis unavailable" message={error || undefined} className="py-6" />;
}

const STATUS_STYLE = {
  good: { tone: "gain", label: "Doing well", icon: CheckCircle2 },
  watch: { tone: "warn", label: "Keep an eye", icon: CircleAlert },
  act: { tone: "loss", label: "Act now", icon: AlertTriangle },
} as const;

function SectionCard({
  title,
  advice,
  loading,
  children,
}: {
  title: string;
  advice: AdvisorSectionAdvice | null;
  loading: boolean;
  children: React.ReactNode;
}) {
  const style = advice ? STATUS_STYLE[advice.status] : null;

  return (
    <Card className="flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[0.95rem] font-semibold text-ink">{title}</h3>
        {style ? (
          <Badge tone={style.tone}>
            <style.icon className="size-3" /> {style.label}
          </Badge>
        ) : null}
      </div>
      <div className="mb-3">{children}</div>
      {advice ? (
        <div className="space-y-2 border-t border-line pt-3 text-sm">
          <p className="text-ink-2">{advice.summary}</p>
          {advice.wins.length ? (
            <ul className="space-y-1">
              {advice.wins.map((win) => (
                <li key={win} className="flex gap-1.5 text-xs text-ink-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-gain" /> {win}
                </li>
              ))}
            </ul>
          ) : null}
          {advice.issues.length ? (
            <ul className="space-y-1">
              {advice.issues.map((issue) => (
                <li key={issue} className="flex gap-1.5 text-xs text-ink-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" /> {issue}
                </li>
              ))}
            </ul>
          ) : null}
          <p className={cn("rounded-xl bg-brand-soft px-3 py-2 text-xs font-medium text-brand-ink")}>Next: {advice.nextStep}</p>
        </div>
      ) : loading ? (
        <div className="space-y-2 border-t border-line pt-3">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
      ) : null}
    </Card>
  );
}

function ProfileSheet({
  open,
  onClose,
  profile,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  profile: AdvisorProfile;
  onSaved: (profile: AdvisorProfile) => void;
}) {
  const [income, setIncome] = useState(profile.monthlyIncome ? String(profile.monthlyIncome) : "");
  const [risk, setRisk] = useState(profile.riskProfile);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/advisor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyIncome: income ? Number(income) : null, riskProfile: risk }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) throw new Error(result?.message || "Unable to save.");

      toast.success("Saved — re-analysing");
      onSaved({ ...profile, monthlyIncome: income ? Number(income) : null, riskProfile: risk });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="About you"
      description="Used only to tailor the advice. Age comes from your date of birth in Settings."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="advisor-profile-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="advisor-profile-form" onSubmit={submit}>
        <FieldGrid>
          <Field label="Monthly take-home income" hint="After tax, all sources">
            <Input inputMode="decimal" value={income} onChange={(event) => setIncome(event.target.value)} placeholder="85000" />
          </Field>
          <Field label="Risk appetite">
            <Select value={risk} onChange={(event) => setRisk(event.target.value as AdvisorProfile["riskProfile"])}>
              <option value="conservative">Conservative — protect capital</option>
              <option value="moderate">Moderate — balanced growth</option>
              <option value="aggressive">Aggressive — maximise growth</option>
            </Select>
          </Field>
        </FieldGrid>
      </form>
    </Sheet>
  );
}
