import Link from "next/link";
import { Compass } from "lucide-react";

/** Centred, token-based shell for login / signup. Safe-area aware. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-canvas px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-6">
        <Link className="mx-auto mb-8 flex flex-col items-center gap-3" href="/">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-cta text-cta-ink shadow-[0_8px_24px_rgba(16,24,40,0.18)]">
            <Compass className="size-7" />
          </span>
          <span className="text-center">
            <span className="block text-xl font-semibold tracking-tight">Wealth Compass</span>
            <span className="mt-0.5 block text-sm text-ink-3">Your complete money picture</span>
          </span>
        </Link>
        {children}
      </main>
    </div>
  );
}
