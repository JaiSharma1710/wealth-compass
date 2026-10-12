"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import countryToCurrency from "country-to-currency";
import toast from "react-hot-toast";
import { Controller, useForm, useWatch } from "react-hook-form";

import banks from "@/constants/banks.json";
import { BankPicker } from "@/components/settings-banks";
import { AppearanceCard, DataSyncCard, InstallCard } from "@/components/settings-extras";
import { Button, Card, CardHeader, Page } from "@/components/ui/kit";
import { Field, FieldGrid, Input, Select } from "@/components/ui/sheet";
import type { SafeUser } from "@/lib/auth";

type CountryOption = {
  code: string;
  name: string;
};
type CurrencyOption = {
  code: string;
  name: string;
  symbol: string;
};

type SettingsFormProps = {
  user: SafeUser;
  countries: CountryOption[];
  currencies: CurrencyOption[];
};

type SettingsValues = {
  fullName: string;
  username: string;
  email: string;
  dateOfBirth: string;
  presentAddress: string;
  permanentAddress: string;
  city: string;
  postalCode: string;
  country: string;
  banks: string[];
  currency: string;
  timezone: string;
};
type SecurityValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};


const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bankOptions = Array.from(new Set((banks as string[]).filter(Boolean)));

const sections = [
  { id: "profile", label: "Profile" },
  { id: "banks", label: "Banks" },
  { id: "security", label: "Security" },
  { id: "appearance", label: "Appearance" },
  { id: "sync", label: "Data sync" },
  { id: "install", label: "Install app" },
];

export function SettingsForm({ user, countries, currencies }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSecurityPending, startSecurityTransition] = useTransition();
  const defaultValues = useMemo(() => mapUserToFormValues(user), [user]);
  const {
    control,
    getValues,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsValues>({
    defaultValues,
  });
  const {
    register: registerSecurity,
    handleSubmit: handleSecuritySubmit,
    reset: resetSecurity,
    formState: {
      errors: securityErrors,
      isSubmitting: isSecuritySubmitting,
      isDirty: isSecurityDirty,
    },
  } = useForm<SecurityValues>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const liveFullName = useWatch({ control, name: "fullName" });
  const liveCountry = useWatch({ control, name: "country" });

  // Normalise legacy free-text country / currency values to ISO codes.
  useEffect(() => {
    const current = getValues("country")?.trim();
    if (!current || !countries.length) return;
    const match = countries.find(
      (country) =>
        country.code === current.toUpperCase() || country.name.toLowerCase() === current.toLowerCase()
    );
    if (match && current !== match.code) setValue("country", match.code, { shouldDirty: false });
  }, [countries, getValues, setValue]);

  useEffect(() => {
    const current = getValues("currency")?.trim();
    if (!current || !currencies.length) return;
    const match = currencies.find(
      (currency) =>
        currency.code === current.toUpperCase() || currency.name.toLowerCase() === current.toLowerCase()
    );
    if (match && current !== match.code) setValue("currency", match.code, { shouldDirty: false });
  }, [currencies, getValues, setValue]);

  useEffect(() => {
    if (!liveCountry || !currencies.length) return;
    const mapped = countryToCurrency[liveCountry.toUpperCase() as keyof typeof countryToCurrency];
    if (!mapped || !currencies.some((currency) => currency.code === mapped)) return;
    if (getValues("currency") === mapped) return;
    setValue("currency", mapped, { shouldDirty: true });
  }, [currencies, getValues, liveCountry, setValue]);

  async function onSubmit(values: SettingsValues) {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    const result = (await response.json().catch(() => null)) as
      | { message?: string; user?: SafeUser }
      | null;

    if (!response.ok) {
      toast.error(result?.message || "Unable to save settings.");
      return;
    }

    if (result?.user) {
      reset(mapUserToFormValues(result.user));
    }

    toast.success(result?.message || "Settings updated successfully.");

    startTransition(() => {
      router.refresh();
    });
  }

  async function onSecuritySubmit(values: SecurityValues) {
    const response = await fetch("/api/profile/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    const result = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    if (!response.ok) {
      toast.error(result?.message || "Unable to update password.");
      return;
    }

    resetSecurity({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    toast.success(result?.message || "Password updated successfully.");

    startSecurityTransition(() => {
      router.refresh();
    });
  }

  const isBusy = isSubmitting || isPending;
  const isSecurityBusy = isSecuritySubmitting || isSecurityPending;
  const saveLabel = isBusy ? "Saving..." : "Save changes";

  return (
    <Page>
      <div className="grid gap-5 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-0 space-y-0.5">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink"
                  href={`#${section.id}`}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 lg:mx-0">
          <form className="space-y-5" id="profile" onSubmit={handleSubmit(onSubmit)}>
            <Card className="scroll-mt-4">
              <div className="mb-5 flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-cta text-lg font-semibold text-cta-ink">
                  {getInitials(liveFullName)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-ink">{liveFullName || "Your profile"}</h2>
                  <p className="truncate text-sm text-ink-3">{user.email}</p>
                </div>
              </div>

              <FieldGrid>
                <Field error={errors.fullName?.message} label="Full name">
                  <Input
                    autoComplete="name"
                    className="text-base sm:text-sm"
                    {...register("fullName", {
                      required: "Full name is required.",
                      minLength: { value: 2, message: "Full name must be at least 2 characters long." },
                    })}
                  />
                </Field>
                <Field error={errors.username?.message} label="Username">
                  <Input
                    autoComplete="username"
                    className="text-base sm:text-sm"
                    {...register("username", {
                      required: "Username is required.",
                      minLength: { value: 2, message: "Username must be at least 2 characters long." },
                      maxLength: { value: 50, message: "Username must be 50 characters or fewer." },
                    })}
                  />
                </Field>
                <Field hint="Email can't be changed." label="Email">
                  <Input
                    className="text-base sm:text-sm"
                    readOnly
                    type="email"
                    {...register("email", {
                      required: "Email is required.",
                      pattern: { value: emailPattern, message: "Please enter a valid email address." },
                    })}
                  />
                </Field>
                <Field error={errors.dateOfBirth?.message} label="Date of birth">
                  <Input
                    className="text-base sm:text-sm"
                    type="date"
                    {...register("dateOfBirth", {
                      validate: (value) =>
                        !value || !Number.isNaN(new Date(value).getTime()) || "Please enter a valid date.",
                    })}
                  />
                </Field>
                <Field error={errors.presentAddress?.message} label="Present address">
                  <Input
                    autoComplete="street-address"
                    className="text-base sm:text-sm"
                    {...register("presentAddress", {
                      maxLength: { value: 160, message: "Present address must be 160 characters or fewer." },
                    })}
                  />
                </Field>
                <Field error={errors.permanentAddress?.message} label="Permanent address">
                  <Input
                    className="text-base sm:text-sm"
                    {...register("permanentAddress", {
                      maxLength: { value: 160, message: "Permanent address must be 160 characters or fewer." },
                    })}
                  />
                </Field>
                <Field error={errors.city?.message} label="City">
                  <Input
                    autoComplete="address-level2"
                    className="text-base sm:text-sm"
                    {...register("city", {
                      maxLength: { value: 80, message: "City must be 80 characters or fewer." },
                    })}
                  />
                </Field>
                <Field error={errors.postalCode?.message} label="Postal code">
                  <Input
                    autoComplete="postal-code"
                    className="text-base sm:text-sm"
                    {...register("postalCode", {
                      maxLength: { value: 20, message: "Postal code must be 20 characters or fewer." },
                    })}
                  />
                </Field>
                <Field error={errors.country?.message} label="Country">
                  <Select className="text-base sm:text-sm" {...register("country")}>
                    <option value="">Select country</option>
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                    {countries.length === 0 && getValues("country") ? (
                      <option value={getValues("country")}>{getValues("country")}</option>
                    ) : null}
                  </Select>
                </Field>
                <Field error={errors.currency?.message} label="Currency">
                  <Select
                    className="text-base sm:text-sm"
                    {...register("currency", { required: "Currency is required." })}
                  >
                    <option value="">Select currency</option>
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code}
                        {currency.symbol ? ` ${currency.symbol}` : ""} - {currency.name}
                      </option>
                    ))}
                    {currencies.length === 0 && getValues("currency") ? (
                      <option value={getValues("currency")}>{getValues("currency")}</option>
                    ) : null}
                  </Select>
                </Field>
                <Field error={errors.timezone?.message} label="Time zone">
                  <Input
                    className="text-base sm:text-sm"
                    placeholder="Asia/Kolkata"
                    {...register("timezone", { required: "Timezone is required." })}
                  />
                </Field>
              </FieldGrid>
            </Card>

            <Card className="scroll-mt-4" id="banks">
              <CardHeader
                subtitle="Your list of banks, used by Cash and Goals."
                title="Banks"
              />
              <Controller
                control={control}
                name="banks"
                render={({ field }) => (
                  <BankPicker onChange={field.onChange} options={bankOptions} values={field.value || []} />
                )}
              />
            </Card>

            <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
              <Button
                className="shadow-lg"
                disabled={isBusy || !isDirty}
                loading={isBusy}
                type="submit"
                variant="primary"
              >
                {saveLabel}
              </Button>
            </div>
          </form>

          <Card className="scroll-mt-4" id="security">
            <CardHeader
              subtitle="Enter your current password, choose a new one, and confirm it."
              title="Security"
            />
            <form className="space-y-3" onSubmit={handleSecuritySubmit(onSecuritySubmit)}>
              <Field error={securityErrors.currentPassword?.message} label="Current password">
                <Input
                  autoComplete="current-password"
                  className="text-base sm:text-sm"
                  type="password"
                  {...registerSecurity("currentPassword", { required: "Current password is required." })}
                />
              </Field>
              <FieldGrid>
                <Field error={securityErrors.newPassword?.message} label="New password">
                  <Input
                    autoComplete="new-password"
                    className="text-base sm:text-sm"
                    type="password"
                    {...registerSecurity("newPassword", {
                      required: "New password is required.",
                      minLength: { value: 8, message: "New password must be at least 8 characters long." },
                    })}
                  />
                </Field>
                <Field error={securityErrors.confirmPassword?.message} label="Confirm password">
                  <Input
                    autoComplete="new-password"
                    className="text-base sm:text-sm"
                    type="password"
                    {...registerSecurity("confirmPassword", {
                      required: "Confirm password is required.",
                      validate: (value, formValues) =>
                        value === formValues.newPassword || "Confirm password must match the new password.",
                    })}
                  />
                </Field>
              </FieldGrid>
              <div className="flex justify-end pt-1">
                <Button
                  disabled={isSecurityBusy || !isSecurityDirty}
                  loading={isSecurityBusy}
                  type="submit"
                  variant="primary"
                >
                  Update password
                </Button>
              </div>
            </form>
          </Card>

          <div className="scroll-mt-4" id="appearance">
            <AppearanceCard />
          </div>
          <div className="scroll-mt-4" id="sync">
            <DataSyncCard />
          </div>
          <div className="scroll-mt-4" id="install">
            <InstallCard />
          </div>

          <Card>
            <form action="/api/signout" className="flex items-center justify-between gap-3" method="post">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Log out</p>
                <p className="text-xs text-ink-3">Sign out of Wealth Compass on this device.</p>
              </div>
              <Button icon={LogOut} type="submit" variant="danger">
                Log out
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </Page>
  );
}

function mapUserToFormValues(user: SafeUser): SettingsValues {
  return {
    fullName: user.fullName,
    username: user.profile.username,
    email: user.email,
    dateOfBirth: user.profile.dateOfBirth,
    presentAddress: user.profile.presentAddress,
    permanentAddress: user.profile.permanentAddress,
    city: user.profile.city,
    postalCode: user.profile.postalCode,
    country: user.profile.country,
    banks: user.profile.banks || [],
    currency: user.profile.currency,
    timezone: user.profile.timezone,
  };
}

function getInitials(fullName: string) {
  const [first = "", second = ""] = fullName.trim().split(/\s+/);

  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase() || "WC";
}
