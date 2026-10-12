import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { PublicShell } from "@/components/public-shell";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function SignupPage() {
  await redirectIfAuthenticated();

  return (
    <PublicShell>
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_rgba(16,24,40,0.06)] sm:p-7">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-ink-3">Track investments, cash, goals and expenses in one place.</p>
        <div className="mt-6">
          <AuthForm cta="Create account" helper="Start with your basic profile details." mode="signup" />
        </div>
      </div>
      <p className="mt-5 text-center text-sm text-ink-3">
        Already have an account?{" "}
        <Link className="font-medium text-brand underline-offset-4 hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </PublicShell>
  );
}
