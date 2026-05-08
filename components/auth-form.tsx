"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";

type AuthFormProps = {
  cta: string;
  helper: string;
  mode: "signin" | "signup";
};

type AuthFormValues = {
  fullName: string;
  email: string;
  password: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({ cta, helper, mode }: AuthFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: AuthFormValues) {
    setServerError(null);

    const payload =
      mode === "signup"
        ? {
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }
        : {
          email: values.email.trim(),
          password: values.password,
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
      setServerError(result?.message || "Authentication failed.");
      return;
    }

    startTransition(() => {
      router.replace("/");
      router.refresh();
    });
  }

  const isBusy = isSubmitting || isPending;

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <p className="text-sm text-muted-foreground">{helper}</p>
      </div>

      {mode === "signup" ? (
        <Field
          autoComplete="name"
          error={errors.fullName?.message}
          label="Full name"
          placeholder="Jai Sharma"
          registration={register("fullName", {
            required: "Full name is required.",
            minLength: {
              value: 2,
              message: "Full name must be at least 2 characters long.",
            },
          })}
          type="text"
        />
      ) : null}

      <Field
        autoComplete="email"
        error={errors.email?.message}
        label="Email"
        placeholder="you@example.com"
        registration={register("email", {
          required: "Email is required.",
          pattern: {
            value: emailPattern,
            message: "Please enter a valid email address.",
          },
        })}
        type="email"
      />

      <Field
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        error={errors.password?.message}
        label="Password"
        placeholder={
          mode === "signup" ? "Create a strong password" : "Enter your password"
        }
        registration={register("password", {
          required: "Password is required.",
          minLength: mode === "signup"
            ? {
              value: 8,
              message: "Password must be at least 8 characters long.",
            }
            : undefined,
        })}
        type="password"
      />

      {serverError ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      ) : null}

      <Button className="w-full" disabled={isBusy} size="lg" type="submit">
        {isBusy ? "Please wait..." : cta}
      </Button>
    </form>
  );
}

function Field({
  label,
  type,
  placeholder,
  autoComplete,
  registration,
  error,
}: {
  label: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        autoComplete={autoComplete}
        className="flex h-12 w-full rounded-xl border border-border bg-background px-4 text-base shadow-sm transition-colors outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
        placeholder={placeholder}
        type={type}
        {...registration}
      />
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </label>
  );
}
