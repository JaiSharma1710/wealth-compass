"use client";

import { Check, ChevronsUpDown, Eye, Moon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import countryToCurrency from "country-to-currency";
import toast from "react-hot-toast";
import {
  Controller,
  useForm,
  useWatch,
  type UseFormRegisterReturn,
} from "react-hook-form";

import banks from "@/constants/banks.json";
import type { SafeUser } from "@/lib/auth";

type SettingsFormProps = {
  user: SafeUser;
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

type SettingsTab = "profile" | "preferences" | "security";
type CountryOption = {
  code: string;
  name: string;
};
type CurrencyOption = {
  code: string;
  name: string;
  symbol: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "profile", label: "Edit Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "security", label: "Security" },
];
const emptyBanks: string[] = [];
const bankOptions = Array.from(new Set((banks as string[]).filter(Boolean)));

export function SettingsForm({ user }: SettingsFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [currenciesError, setCurrenciesError] = useState<string | null>(null);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
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
  const liveFullName = useWatch({
    control,
    name: "fullName",
  });
  const liveCountry = useWatch({
    control,
    name: "country",
  });

  useEffect(() => {
    const themeSync = window.setTimeout(() => {
      setDarkModeEnabled(document.documentElement.classList.contains("dark"));
    }, 0);

    return () => {
      window.clearTimeout(themeSync);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCountries() {
      setCountriesLoading(true);
      setCountriesError(null);

      const response = await fetch("/api/countries");
      const result = (await response.json().catch(() => null)) as
        | { countries?: CountryOption[]; message?: string }
        | null;

      if (!active) {
        return;
      }

      if (!response.ok) {
        setCountries([]);
        setCountriesError(result?.message || "Unable to load countries.");
        setCountriesLoading(false);
        return;
      }

      setCountries(result?.countries || []);
      setCountriesLoading(false);
    }

    void loadCountries();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCurrencies() {
      setCurrenciesLoading(true);
      setCurrenciesError(null);

      const response = await fetch("/api/currencies");
      const result = (await response.json().catch(() => null)) as
        | { currencies?: CurrencyOption[]; message?: string }
        | null;

      if (!active) {
        return;
      }

      if (!response.ok) {
        setCurrencies([]);
        setCurrenciesError(result?.message || "Unable to load currencies.");
        setCurrenciesLoading(false);
        return;
      }

      setCurrencies(result?.currencies || []);
      setCurrenciesLoading(false);
    }

    void loadCurrencies();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!countries.length) {
      return;
    }

    const currentCountry = getValues("country")?.trim();
    if (!currentCountry) {
      return;
    }

    const matchedCountry = countries.find(
      (country) =>
        country.code === currentCountry.toUpperCase() ||
        country.name.toLowerCase() === currentCountry.toLowerCase()
    );

    if (matchedCountry && currentCountry !== matchedCountry.code) {
      setValue("country", matchedCountry.code, {
        shouldDirty: false,
      });
    }
  }, [countries, getValues, setValue]);

  useEffect(() => {
    if (!currencies.length) {
      return;
    }

    const currentCurrency = getValues("currency")?.trim();
    if (!currentCurrency) {
      return;
    }

    const matchedCurrency = currencies.find(
      (currency) =>
        currency.code === currentCurrency.toUpperCase() ||
        currency.name.toLowerCase() === currentCurrency.toLowerCase()
    );

    if (matchedCurrency && currentCurrency !== matchedCurrency.code) {
      setValue("currency", matchedCurrency.code, {
        shouldDirty: false,
      });
    }
  }, [currencies, getValues, setValue]);

  useEffect(() => {
    if (!liveCountry || !currencies.length) {
      return;
    }

    const mappedCurrencyCode =
      countryToCurrency[liveCountry.toUpperCase() as keyof typeof countryToCurrency];

    if (!mappedCurrencyCode) {
      return;
    }

    const hasMappedCurrency = currencies.some(
      (currency) => currency.code === mappedCurrencyCode
    );

    if (!hasMappedCurrency) {
      return;
    }

    const currentCurrency = getValues("currency");
    if (currentCurrency === mappedCurrencyCode) {
      return;
    }

    setValue("currency", mappedCurrencyCode, {
      shouldDirty: true,
    });
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

  function toggleDarkMode(enabled: boolean) {
    setDarkModeEnabled(enabled);
    document.documentElement.classList.toggle("dark", enabled);
    localStorage.setItem("theme", enabled ? "dark" : "light");
  }

  const isBusy = isSubmitting || isPending;
  const isSecurityBusy = isSecuritySubmitting || isSecurityPending;

  return (
    <div className="h-full bg-[#f5f7fb] p-4 sm:p-6">
      <div className="h-full rounded-[2rem] border border-[#e6ebf2] bg-white px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <div className="border-b border-[#eef2f7]">
          <div className="flex gap-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`border-b-2 px-1 pb-3 text-base font-medium transition ${
                  activeTab === tab.id
                    ? "border-[#111111] text-neutral-950"
                    : "border-transparent text-neutral-400 hover:text-neutral-700"
                }`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "security" ? (
          <form
            className="flex h-[calc(100%-3.75rem)] flex-col"
            onSubmit={handleSecuritySubmit(onSecuritySubmit)}
          >
            <div className="flex-1 overflow-y-auto py-6">
              <div className="max-w-xl space-y-5">
                <div className="rounded-[1.5rem] border border-[#e6ebf2] bg-[#fafaf8] p-5">
                  <p className="text-base font-semibold text-neutral-950">Change Password</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    Enter your current password, choose a new one, and confirm it before saving.
                  </p>
                </div>

                <InputField
                  error={securityErrors.currentPassword?.message}
                  label="Current Password"
                  placeholder="Enter current password"
                  registration={registerSecurity("currentPassword", {
                    required: "Current password is required.",
                  })}
                  type="password"
                />

                <InputField
                  error={securityErrors.newPassword?.message}
                  label="New Password"
                  placeholder="Enter new password"
                  registration={registerSecurity("newPassword", {
                    required: "New password is required.",
                    minLength: {
                      value: 8,
                      message: "New password must be at least 8 characters long.",
                    },
                  })}
                  type="password"
                />

                <InputField
                  error={securityErrors.confirmPassword?.message}
                  label="Confirm Password"
                  placeholder="Confirm new password"
                  registration={registerSecurity("confirmPassword", {
                    required: "Confirm password is required.",
                    validate: (value, formValues) =>
                      value === formValues.newPassword || "Confirm password must match the new password.",
                  })}
                  type="password"
                />
              </div>
            </div>

            <div className="flex justify-end border-t border-[#eef2f7] pt-5">
              <button
                className="min-w-36 rounded-2xl bg-[#111111] px-7 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSecurityBusy || !isSecurityDirty}
                type="submit"
              >
                {isSecurityBusy ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        ) : (
          <form className="flex h-[calc(100%-3.75rem)] flex-col" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex-1 overflow-y-auto py-6">
              {activeTab === "profile" ? (
                <div className="max-h-full overflow-y-auto pr-1">
                  <div className="grid gap-6 lg:grid-cols-[8.5rem_1fr]">
                    <div className="flex items-start justify-center lg:pt-2">
                      <div className="flex size-24 items-center justify-center rounded-full bg-[#111111] text-2xl font-semibold text-white shadow-sm">
                        {getInitials(liveFullName)}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <InputField
                        error={errors.fullName?.message}
                        label="Your Name"
                        placeholder="Charlene Reed"
                        registration={register("fullName", {
                          required: "Full name is required.",
                          minLength: {
                            value: 2,
                            message: "Full name must be at least 2 characters long.",
                          },
                        })}
                      />

                      <InputField
                        error={errors.username?.message}
                        label="User Name"
                        placeholder="charlene.reed"
                        registration={register("username", {
                          required: "Username is required.",
                          minLength: {
                            value: 2,
                            message: "Username must be at least 2 characters long.",
                          },
                          maxLength: {
                            value: 50,
                            message: "Username must be 50 characters or fewer.",
                          },
                        })}
                      />

                      <InputField
                        label="Email"
                        placeholder="charlene.reed@gmail.com"
                        registration={register("email", {
                          required: "Email is required.",
                          pattern: {
                            value: emailPattern,
                            message: "Please enter a valid email address.",
                          },
                        })}
                        readOnly
                        type="email"
                      />

                      <Controller
                        control={control}
                        name="banks"
                        render={({ field }) => (
                          <BankMultiSelect
                            label="Banks"
                            onChange={field.onChange}
                            options={bankOptions}
                            placeholder="Select banks"
                            values={field.value || []}
                          />
                        )}
                      />

                      <InputField
                        error={errors.dateOfBirth?.message}
                        label="Date Of Birth"
                        placeholder="1990-01-25"
                        registration={register("dateOfBirth", {
                          validate: (value) =>
                            !value || !Number.isNaN(new Date(value).getTime()) || "Please enter a valid date.",
                        })}
                        type="date"
                      />

                      <InputField
                        error={errors.presentAddress?.message}
                        label="Present Address"
                        placeholder="San Jose, California, USA"
                        registration={register("presentAddress", {
                          maxLength: {
                            value: 160,
                            message: "Present address must be 160 characters or fewer.",
                          },
                        })}
                      />

                      <InputField
                        error={errors.permanentAddress?.message}
                        label="Permanent Address"
                        placeholder="San Jose, California, USA"
                        registration={register("permanentAddress", {
                          maxLength: {
                            value: 160,
                            message: "Permanent address must be 160 characters or fewer.",
                          },
                        })}
                      />

                      <InputField
                        error={errors.city?.message}
                        label="City"
                        placeholder="San Jose"
                        registration={register("city", {
                          maxLength: {
                            value: 80,
                            message: "City must be 80 characters or fewer.",
                          },
                        })}
                      />

                      <InputField
                        error={errors.postalCode?.message}
                        label="Postal Code"
                        placeholder="45962"
                        registration={register("postalCode", {
                          maxLength: {
                            value: 20,
                            message: "Postal code must be 20 characters or fewer.",
                          },
                        })}
                      />

                      <Controller
                        control={control}
                        name="country"
                        render={({ field }) => (
                          <CountryCombobox
                            error={errors.country?.message || countriesError || undefined}
                            label="Country"
                            loading={countriesLoading}
                            onChange={field.onChange}
                            options={countries}
                            placeholder="Search country"
                            value={field.value}
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "preferences" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <ThemeToggleField
                    checked={darkModeEnabled}
                    onChange={toggleDarkMode}
                  />

                  <Controller
                    control={control}
                    name="currency"
                    rules={{
                      required: "Currency is required.",
                    }}
                    render={({ field }) => (
                      <CurrencyCombobox
                        error={errors.currency?.message || currenciesError || undefined}
                        label="Currency"
                        loading={currenciesLoading}
                        onChange={field.onChange}
                        options={currencies}
                        placeholder="Search currency"
                        value={field.value}
                      />
                    )}
                  />

                  <InputField
                    error={errors.timezone?.message}
                    label="Time Zone"
                    placeholder="Asia/Kolkata"
                    registration={register("timezone", {
                      required: "Timezone is required.",
                    })}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex justify-end border-t border-[#eef2f7] pt-5">
              <button
                className="min-w-36 rounded-2xl bg-[#111111] px-7 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBusy || !isDirty}
                type="submit"
              >
                {isBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ThemeToggleField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-[5.15rem] items-center justify-between gap-4 rounded-[1.25rem] border border-[#dbe2ee] bg-white px-4 py-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#f7f7f5] text-neutral-700">
          <Moon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-800">Dark Mode</p>
          <p className="mt-1 text-xs text-neutral-500">Applies instantly to this browser.</p>
        </div>
      </div>
      <button
        aria-checked={checked}
        aria-label="Toggle dark mode"
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${
          checked ? "bg-[#111111]" : "bg-[#dbe2ee]"
        }`}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          className={`absolute top-1 size-6 rounded-full bg-white shadow-sm transition ${
            checked ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function InputField({
  label,
  registration,
  error,
  type = "text",
  disabled,
  readOnly,
  value,
  placeholder,
}: {
  label: string;
  registration?: UseFormRegisterReturn;
  error?: string;
  type?: string;
  disabled?: boolean;
  readOnly?: boolean;
  value?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2.5">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      <input
        className="flex h-[2.9rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.92rem] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5 read-only:bg-[#f7f7f5] read-only:text-neutral-500 disabled:bg-[#f7f7f5] disabled:text-neutral-400"
        disabled={disabled}
        placeholder={placeholder}
        readOnly={readOnly}
        type={type}
        value={value}
        {...registration}
      />
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </label>
  );
}

function SearchableOverlayCombobox({
  label,
  value,
  onChange,
  options,
  error,
  loading,
  placeholder,
  getOptionValue,
  getOptionLabel,
  getOptionMeta,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<CountryOption | CurrencyOption>;
  error?: string;
  loading: boolean;
  placeholder: string;
  getOptionValue: (option: CountryOption | CurrencyOption) => string;
  getOptionLabel: (option: CountryOption | CurrencyOption) => string;
  getOptionMeta?: (option: CountryOption | CurrencyOption) => string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selectedOption = useMemo(
    () =>
      options.find((option) => getOptionValue(option) === value) ||
      options.find((option) => getOptionLabel(option).toLowerCase() === value.toLowerCase()) ||
      null,
    [getOptionLabel, getOptionValue, options, value]
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = draftQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter(
      (option) =>
        getOptionLabel(option).toLowerCase().includes(normalizedQuery) ||
        getOptionValue(option).toLowerCase().includes(normalizedQuery) ||
        (getOptionMeta?.(option).toLowerCase().includes(normalizedQuery) ?? false)
    );
  }, [draftQuery, getOptionLabel, getOptionMeta, getOptionValue, options]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !containerRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    function updateDropdownPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setDropdownStyle({
        left: rect.left,
        top: rect.bottom + 8,
        width: rect.width,
        maxHeight: Math.max(180, window.innerHeight - rect.bottom - 24),
      });
    }

    updateDropdownPosition();

    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open]);

  function handleSelect(option: CountryOption | CurrencyOption) {
    onChange(getOptionValue(option));
    setDraftQuery(getOptionLabel(option));
    setOpen(false);
  }

  const committedLabel = selectedOption ? getOptionLabel(selectedOption) : value || "";
  const inputValue = open
    ? draftQuery
    : selectedOption
      ? committedLabel
      : value || "";
  const activePlaceholder = open && committedLabel ? committedLabel : placeholder;

  return (
    <div className="relative" ref={containerRef}>
      <label className="block space-y-2.5">
        <span className="text-sm font-medium text-neutral-800">{label}</span>
        <div className="relative" ref={triggerRef}>
          <input
            className="flex h-[2.9rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 pr-11 text-[0.92rem] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5"
            onChange={(event) => {
              const nextQuery = event.target.value;
              setDraftQuery(nextQuery);
              setOpen(true);
            }}
            onFocus={() => {
              setDraftQuery("");
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
              }

              if (event.key === "Enter" && open && filteredOptions[0]) {
                event.preventDefault();
                handleSelect(filteredOptions[0]);
              }
            }}
            placeholder={activePlaceholder}
            value={inputValue}
          />
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label="Toggle country options"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition hover:text-neutral-700"
            onClick={() => {
              if (!open) {
                setDraftQuery("");
              }

              setOpen((current) => !current);
            }}
            type="button"
          >
            <ChevronsUpDown className="size-4" />
          </button>
        </div>
      </label>

      {open && dropdownStyle
        ? createPortal(
          <div
            className="wc-portal fixed z-50 overflow-y-auto rounded-[1rem] border border-[#dbe2ee] bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.12)]"
            ref={dropdownRef}
            style={{
              left: dropdownStyle.left,
              top: dropdownStyle.top,
              width: dropdownStyle.width,
              maxHeight: dropdownStyle.maxHeight,
            }}
          >
            {loading ? (
              <p className="px-3 py-2 text-sm text-neutral-500">Loading countries...</p>
            ) : filteredOptions.length ? (
              <div className="space-y-1">
                {filteredOptions.map((option) => {
                  const selected =
                    selectedOption && getOptionValue(selectedOption) === getOptionValue(option);
                  const meta = getOptionMeta?.(option);

                  return (
                    <button
                      key={getOptionValue(option)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
                      onClick={() => handleSelect(option)}
                      type="button"
                    >
                      <span>
                        {getOptionLabel(option)}
                        {meta ? (
                          <span className="ml-2 text-xs text-neutral-400">{meta}</span>
                        ) : null}
                      </span>
                      {selected ? <Check className="size-4 text-neutral-900" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="px-3 py-2 text-sm text-neutral-500">No countries found.</p>
            )}
          </div>,
          document.body
        )
        : null}

      {error ? <span className="mt-2 block text-sm text-destructive">{error}</span> : null}
    </div>
  );
}

function BankMultiSelect({
  label,
  values,
  onChange,
  options,
  placeholder,
  error,
}: {
  label: string;
  values?: string[];
  onChange: (value: string[]) => void;
  options: string[];
  placeholder: string;
  error?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const selectedValues = values || emptyBanks;
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = draftQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
  }, [draftQuery, options]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !containerRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    function updateDropdownPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setDropdownStyle({
        left: rect.left,
        top: rect.bottom + 8,
        width: rect.width,
        maxHeight: Math.max(220, window.innerHeight - rect.bottom - 24),
      });
    }

    updateDropdownPosition();

    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open]);

  function toggleBank(bank: string) {
    if (selectedSet.has(bank)) {
      onChange(selectedValues.filter((selectedBank) => selectedBank !== bank));
      return;
    }

    onChange([...selectedValues, bank]);
  }

  function removeBank(bank: string) {
    onChange(selectedValues.filter((selectedBank) => selectedBank !== bank));
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="space-y-2.5">
        <span className="block text-sm font-medium text-neutral-800">{label}</span>
        <div
          className="flex min-h-[2.9rem] w-full items-center rounded-[1rem] border border-[#dbe2ee] bg-white text-[0.92rem] text-neutral-900 shadow-sm transition focus-within:border-[#111111] focus-within:ring-3 focus-within:ring-black/5"
          ref={triggerRef}
        >
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            className="flex min-w-0 flex-1 items-center px-3.5 py-3 text-left outline-none"
            onClick={() => {
              setDraftQuery("");
              setOpen((current) => !current);
            }}
            type="button"
          >
            <span className={selectedValues.length ? "block truncate" : "block truncate text-neutral-400"}>
              {selectedValues.length
                ? selectedValues.length === 1
                  ? selectedValues[0]
                  : `${selectedValues.length} banks selected`
                : placeholder}
            </span>
          </button>
          <div className="flex items-center gap-1 pr-3">
            <button
              aria-label="View selected banks"
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-300 disabled:text-neutral-300"
              disabled={!selectedValues.length}
              onClick={() => {
                setOpen(false);
                setViewOpen(true);
              }}
              type="button"
            >
              <Eye className="size-4" />
            </button>
            <button
              aria-label="Toggle bank options"
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
              onClick={() => {
                setDraftQuery("");
                setOpen((current) => !current);
              }}
              type="button"
            >
              <ChevronsUpDown className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {open && dropdownStyle
        ? createPortal(
          <div
            className="wc-portal fixed z-50 rounded-[1rem] border border-[#dbe2ee] bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.12)]"
            ref={dropdownRef}
            style={{
              left: dropdownStyle.left,
              top: dropdownStyle.top,
              width: dropdownStyle.width,
              maxHeight: dropdownStyle.maxHeight,
            }}
          >
            <input
              autoFocus
              className="mb-2 flex h-10 w-full rounded-xl border border-[#dbe2ee] bg-white px-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5"
              onChange={(event) => setDraftQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder="Search banks"
              value={draftQuery}
            />
            {selectedValues.length ? (
              <div className="mb-2 flex items-center justify-between rounded-xl bg-[#f7f7f5] px-3 py-2">
                <span className="truncate text-xs text-neutral-500">
                  {selectedValues.length} selected
                </span>
                <button
                  className="text-xs font-medium text-neutral-700 transition hover:text-neutral-950"
                  onClick={() => onChange([])}
                  type="button"
                >
                  Clear all
                </button>
              </div>
            ) : null}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: Math.max(140, dropdownStyle.maxHeight - 104) }}
            >
              {filteredOptions.length ? (
                <div className="space-y-1">
                  {filteredOptions.map((bank) => {
                    const selected = selectedSet.has(bank);

                    return (
                      <button
                        aria-selected={selected}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
                        key={bank}
                        onClick={() => toggleBank(bank)}
                        role="option"
                        type="button"
                      >
                        <span>{bank}</span>
                        {selected ? <Check className="size-4 shrink-0 text-neutral-900" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="px-3 py-2 text-sm text-neutral-500">No banks found.</p>
              )}
            </div>
          </div>,
          document.body
        )
        : null}

      {viewOpen
        ? createPortal(
          <div
            className="wc-portal fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4 py-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setViewOpen(false);
              }
            }}
          >
            <div className="w-full max-w-lg rounded-[1.25rem] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
              <div className="flex items-center justify-between border-b border-[#eef2f7] px-5 py-4">
                <div>
                  <p className="text-base font-semibold text-neutral-950">Selected Banks</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {selectedValues.length} {selectedValues.length === 1 ? "bank" : "banks"} selected
                  </p>
                </div>
                <button
                  aria-label="Close selected banks"
                  className="rounded-xl p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
                  onClick={() => setViewOpen(false)}
                  type="button"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="px-5 py-4">
                {selectedValues.length ? (
                  <div className="max-h-72 overflow-y-auto rounded-xl border border-[#eef2f7]">
                    <div className="divide-y divide-[#eef2f7]">
                    {selectedValues.map((bank, index) => (
                      <div
                        className="grid grid-cols-[2rem_1fr_auto] items-start gap-3 px-4 py-3 text-sm"
                        key={bank}
                      >
                        <span className="text-neutral-400">{index + 1}.</span>
                        <span className="text-neutral-800">{bank}</span>
                        <button
                          aria-label={`Remove ${bank}`}
                          className="rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
                          onClick={() => removeBank(bank)}
                          type="button"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-[#dbe2ee] px-4 py-8 text-center text-sm text-neutral-500">
                    No banks selected.
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
        : null}

      {error ? <span className="mt-2 block text-sm text-destructive">{error}</span> : null}
    </div>
  );
}

function CountryCombobox(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: CountryOption[];
  error?: string;
  loading: boolean;
  placeholder: string;
}) {
  return (
    <SearchableOverlayCombobox
      {...props}
      getOptionLabel={(option) => (option as CountryOption).name}
      getOptionMeta={(option) => (option as CountryOption).code}
      getOptionValue={(option) => (option as CountryOption).code}
    />
  );
}

function CurrencyCombobox(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: CurrencyOption[];
  error?: string;
  loading: boolean;
  placeholder: string;
}) {
  return (
    <SearchableOverlayCombobox
      {...props}
      getOptionLabel={(option) => (option as CurrencyOption).name}
      getOptionMeta={(option) => {
        const currency = option as CurrencyOption;
        return `${currency.code}${currency.symbol ? ` ${currency.symbol}` : ""}`;
      }}
      getOptionValue={(option) => (option as CurrencyOption).code}
    />
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
