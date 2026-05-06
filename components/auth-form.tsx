"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type AuthFormProps = {
  cta: string;
  helper: string;
  mode: "signin" | "signup";
};

export function AuthForm({ cta, helper, mode }: AuthFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload =
      mode === "signup"
        ? {
            fullName: String(formData.get("fullName") || ""),
            email: String(formData.get("email") || ""),
            password: String(formData.get("password") || ""),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }
        : {
            email: String(formData.get("email") || ""),
            password: String(formData.get("password") || ""),
          };

    const response = await fetch(mode === "signup" ? "/api/signup" : "/api/signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    if (!response.ok) {
      setError(result?.message || "Authentication failed.");
      return;
    }

    startTransition(() => {
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <p className="text-sm text-muted-foreground">{helper}</p>
      </div>
      {mode === "signup" ? (
        <Field
          autoComplete="name"
          label="Full name"
          name="fullName"
          placeholder="Jai Sharma"
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
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        label="Password"
        name="password"
        placeholder={
          mode === "signup" ? "Create a strong password" : "Enter your password"
        }
        type="password"
      />
      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Button className="w-full" disabled={isPending} size="lg" type="submit">
        {isPending ? "Please wait..." : cta}
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
        required
        type={type}
      />
    </label>
  );
}
