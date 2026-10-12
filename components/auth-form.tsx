"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";

import { Button } from "@/components/ui/kit";
import { Field as FormField, Input } from "@/components/ui/sheet";

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
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <p className="text-xs text-ink-3">{helper}</p>

      {mode === "signup" ? (
        <AuthField
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

      <AuthField
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

      <AuthField
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
        <div className="rounded-xl border border-loss/30 bg-loss-soft px-3.5 py-2.5 text-sm text-loss" role="alert">
          {serverError}
        </div>
      ) : null}

      <Button className="h-11 w-full text-base sm:text-sm" loading={isBusy} type="submit" variant="primary">
        {isBusy ? "Please wait..." : cta}
      </Button>
    </form>
  );
}

function AuthField({
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
    <FormField error={error} label={label}>
      <Input
        autoComplete={autoComplete}
        className="h-11 text-base"
        placeholder={placeholder}
        type={type}
        {...registration}
      />
    </FormField>
  );
}
