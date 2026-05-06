import Link from "next/link";
import { Compass } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top,_var(--color-muted),_transparent_32%),linear-gradient(180deg,var(--color-background),color-mix(in_oklab,var(--color-muted)_35%,white))] text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
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
          <Link className={buttonVariants({ variant: "ghost" })} href="/login">
            Log in
          </Link>
          <Link className={buttonVariants({ variant: "default" })} href="/signup">
            Get started
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
