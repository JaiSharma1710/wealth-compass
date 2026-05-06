import { Database, Lock, UserCircle2 } from "lucide-react";

import { requireCurrentUser } from "@/lib/auth";

export default async function InternalPage() {
  const user = await requireCurrentUser();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-xl shadow-black/5 backdrop-blur">
          <div className="rounded-[1.5rem] border border-border/70 bg-background p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Lock className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Internal access</p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Private application area
                </h1>
              </div>
            </div>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground">
              This page is rendered only after the server verifies the JWT cookie
              and resolves the corresponding user from MongoDB.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <InfoCard
                icon={<UserCircle2 className="size-5" />}
                label="User ID"
                value={user.id}
              />
              <InfoCard
                icon={<Database className="size-5" />}
                label="Collection"
                value="users"
              />
              <InfoCard
                icon={<Lock className="size-5" />}
                label="Session"
                value="JWT cookie"
              />
            </div>
          </div>
        </section>
        <aside className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-xl shadow-black/5 backdrop-blur">
          <div className="rounded-[1.5rem] border border-border/70 bg-background p-6">
            <p className="text-sm text-muted-foreground">Stored profile</p>
            <dl className="mt-5 space-y-4">
              <DetailRow label="Full name" value={user.fullName} />
              <DetailRow label="Email" value={user.email} />
              <DetailRow label="Role" value={user.role} />
              <DetailRow label="Currency" value={user.profile.currency} />
              <DetailRow label="Timezone" value={user.profile.timezone} />
            </dl>
          </div>
        </aside>
      </div>
    </main>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
      <div className="flex size-10 items-center justify-center rounded-xl bg-background text-foreground shadow-sm">
        {icon}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
