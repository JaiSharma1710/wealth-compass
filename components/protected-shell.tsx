import Link from "next/link";
import { Compass } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { SafeUser } from "@/lib/auth";

export function ProtectedShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SafeUser;
}) {
  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top,_var(--color-muted),_transparent_32%),linear-gradient(180deg,var(--color-background),color-mix(in_oklab,var(--color-muted)_35%,white))] text-foreground">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <Link className="flex items-center gap-3" href="/">
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
            <Link className={buttonVariants({ variant: "ghost" })} href="/">
              Home
            </Link>
            <Link className={buttonVariants({ variant: "ghost" })} href="/internal">
              Internal
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-2 text-sm shadow-sm">
            <p className="font-medium text-foreground">{user.fullName}</p>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
          <form action="/api/signout" method="post">
            <button className={buttonVariants({ variant: "outline" })} type="submit">
              Logout
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
