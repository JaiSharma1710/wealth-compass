import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { PublicShell } from "@/components/public-shell";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function SignupPage() {
  await redirectIfAuthenticated();

  return (
    <PublicShell>
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-12">
        <div className="grid w-full gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="flex flex-col justify-center">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Get started
            </p>
            <h1 className="mt-4 max-w-lg text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Create your protected Wealth Compass workspace
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              Your account is stored in MongoDB and immediately receives a secure
              JWT session cookie after signup.
            </p>
          </section>
          <section className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-xl shadow-black/5 backdrop-blur">
            <div className="rounded-[1.5rem] border border-border/70 bg-background p-6 sm:p-8">
              <AuthForm
                cta="Create account"
                helper="Start with your basic profile details."
                mode="signup"
              />
              <div className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  href="/login"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
