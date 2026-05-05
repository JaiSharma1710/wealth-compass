"use client";

import { useSyncExternalStore } from "react";
import { BarChart3, Compass, ShieldCheck, Sparkles } from "lucide-react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import { Button, buttonVariants } from "@/components/ui/button";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top,_var(--color-muted),_transparent_32%),linear-gradient(180deg,var(--color-background),color-mix(in_oklab,var(--color-muted)_35%,white))] text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link className="flex items-center gap-3" to="/">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Compass className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Personal Finance OS
            </p>
            <p className="text-lg font-semibold tracking-tight">Wealth Compass</p>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <Link className={buttonVariants({ variant: "ghost" })} to="/login">
            Log in
          </Link>
          <Link className={buttonVariants({ variant: "default" })} to="/signup">
            Get started
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}

function HomePage() {
  return (
    <Shell>
      <main className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-20 pt-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <section>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-sm text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="size-4" />
            Plan, track, and grow with one clear dashboard.
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
            Make better money decisions without spreadsheet fatigue.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Wealth Compass gives you a clean view of cash flow, goals, and next
            actions so your financial plan stays usable day to day.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className={buttonVariants({ size: "lg", variant: "default" })} to="/signup">
              Create your account
            </Link>
            <Link className={buttonVariants({ size: "lg", variant: "outline" })} to="/login">
              I already have an account
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <FeatureCard
              icon={<BarChart3 className="size-5" />}
              title="Snapshot analytics"
              copy="Track spending trends, net worth movement, and account balance changes at a glance."
            />
            <FeatureCard
              icon={<Compass className="size-5" />}
              title="Goal guidance"
              copy="Translate long-term financial targets into practical monthly actions."
            />
            <FeatureCard
              icon={<ShieldCheck className="size-5" />}
              title="Clear control"
              copy="Keep important habits visible with focused prompts instead of cluttered workflows."
            />
          </div>
        </section>
        <section className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-xl shadow-black/5 backdrop-blur">
          <div className="rounded-[1.5rem] border border-border/70 bg-background p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly health</p>
                <h2 className="mt-2 text-3xl font-semibold">$12,480</h2>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                +8.4%
              </span>
            </div>
            <div className="mt-6 space-y-4">
              <MetricRow label="Emergency fund" value="82%" />
              <MetricRow label="Savings rate" value="27%" />
              <MetricRow label="Debt payoff progress" value="61%" />
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <StatPanel label="Upcoming bill" value="Mortgage" subcopy="Due in 4 days" />
            <StatPanel label="Next milestone" value="Travel fund" subcopy="$1,240 remaining" />
          </div>
        </section>
      </main>
    </Shell>
  );
}

function LoginPage() {
  return (
    <Shell>
      <AuthLayout
        eyebrow="Welcome back"
        title="Log in to Wealth Compass"
        description="Review your plan, recent activity, and next financial priorities."
        footer={
          <p className="text-sm text-muted-foreground">
            New here?{" "}
            <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/signup">
              Create an account
            </Link>
          </p>
        }
      >
        <AuthForm
          cta="Log in"
          helper="Use your email and password to continue."
        />
      </AuthLayout>
    </Shell>
  );
}

function SignupPage() {
  return (
    <Shell>
      <AuthLayout
        eyebrow="Get started"
        title="Create your Wealth Compass account"
        description="Set up your profile and start organizing your financial goals in one place."
        footer={
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/login">
              Log in
            </Link>
          </p>
        }
      >
        <AuthForm
          includeName
          cta="Create account"
          helper="Start with the essentials. You can connect the rest later."
        />
      </AuthLayout>
    </Shell>
  );
}

function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-12">
      <div className="grid w-full gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex flex-col justify-center">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-lg text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
            {description}
          </p>
        </section>
        <section className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-xl shadow-black/5 backdrop-blur">
          <div className="rounded-[1.5rem] border border-border/70 bg-background p-6 sm:p-8">
            {children}
            <div className="mt-6 border-t border-border pt-6">{footer}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthForm({
  includeName = false,
  cta,
  helper,
}: {
  includeName?: boolean;
  cta: string;
  helper: string;
}) {
  return (
    <form className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">{helper}</p>
      </div>
      {includeName ? (
        <Field
          autoComplete="name"
          label="Full name"
          name="name"
          placeholder="Jordan Lee"
          type="text"
        />
      ) : null}
      <Field
        autoComplete="email"
        label="Email"
        name="email"
        placeholder="you@example.com"
        type="email"
      />
      <Field
        autoComplete={includeName ? "new-password" : "current-password"}
        label="Password"
        name="password"
        placeholder={includeName ? "Create a secure password" : "Enter your password"}
        type="password"
      />
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">
          <input className="size-4 rounded border-border" type="checkbox" />
          Remember me
        </label>
        <a className="font-medium text-foreground underline-offset-4 hover:underline" href="#">
          Forgot password?
        </a>
      </div>
      <Button className="w-full" size="lg" type="submit">
        {cta}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        autoComplete={autoComplete}
        className="flex h-12 w-full rounded-xl border border-border bg-background px-4 text-base shadow-sm transition-colors outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
        name={name}
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}

function FeatureCard({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm backdrop-blur">
      <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: value }} />
      </div>
    </div>
  );
}

function StatPanel({
  label,
  value,
  subcopy,
}: {
  label: string;
  value: string;
  subcopy: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{subcopy}</p>
    </div>
  );
}

export default function RoutedApp() {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16">
        <div className="rounded-2xl border border-border bg-card px-6 py-4 text-sm text-muted-foreground shadow-sm">
          Loading Wealth Compass...
        </div>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<HomePage />} path="/" />
        <Route element={<LoginPage />} path="/login" />
        <Route element={<SignupPage />} path="/signup" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
