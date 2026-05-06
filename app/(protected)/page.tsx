import Link from "next/link";
import { ArrowRight, Compass, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await requireCurrentUser();

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-20 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <section>
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/85 px-3 py-1 text-sm text-muted-foreground shadow-sm backdrop-blur">
          <Sparkles className="size-4" />
          Authenticated dashboard for signed-in users only
        </div>
        <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
          Welcome back, {user.fullName.split(" ")[0]}.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Your session is backed by a JWT stored in an HTTP-only cookie, and
          protected routes now redirect unauthenticated traffic to the login page.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className={buttonVariants({ size: "lg", variant: "default" })}
            href="/internal"
          >
            Open Internal Page
            <ArrowRight className="size-4" />
          </Link>
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </div>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <FeatureCard
            copy="Your home page is now protected on the server before any dashboard content renders."
            icon={<ShieldCheck className="size-5" />}
            title="Protected access"
          />
          <FeatureCard
            copy="New user accounts are created in MongoDB with a structured Mongoose schema and timestamps."
            icon={<Compass className="size-5" />}
            title="Mongo-backed users"
          />
          <FeatureCard
            copy="Session cookies last seven days and are verified on every protected request."
            icon={<TrendingUp className="size-5" />}
            title="JWT sessions"
          />
        </div>
      </section>
      <section className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-xl shadow-black/5 backdrop-blur">
        <div className="rounded-[1.5rem] border border-border/70 bg-background p-6">
          <p className="text-sm text-muted-foreground">Profile snapshot</p>
          <h2 className="mt-2 text-3xl font-semibold">{user.fullName}</h2>
          <div className="mt-6 space-y-4">
            <MetricRow label="Access level" value={user.role} />
            <MetricRow label="Preferred currency" value={user.profile.currency} />
            <MetricRow label="Timezone" value={user.profile.timezone} />
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <StatPanel
            label="Member since"
            subcopy="Auto-saved from MongoDB timestamps"
            value={new Date(user.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          />
          <StatPanel
            label="Last login"
            subcopy="Updated each successful signin"
            value={
              user.lastLoginAt
                ? new Date(user.lastLoginAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "Just now"
            }
          />
        </div>
      </section>
    </main>
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
    <div className="rounded-2xl border border-border/70 bg-muted/50 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-medium text-foreground">{value}</p>
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
