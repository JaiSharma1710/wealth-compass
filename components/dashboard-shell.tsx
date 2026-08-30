"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Coins,
  Compass,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Landmark,
  LineChart,
  LogOut,
  Menu,
  PieChart,
  Settings,
  Target,
  Wallet,
  X,
} from "lucide-react";

import type { SafeUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  group: "Overview" | "Portfolio" | "Planning" | "Account";
};

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", group: "Overview" },
  { href: "/stocks", icon: LineChart, label: "Stocks", group: "Portfolio" },
  { href: "/mutual-funds", icon: PieChart, label: "Mutual Funds", group: "Portfolio" },
  { href: "/gold", icon: Coins, label: "Gold", group: "Portfolio" },
  { href: "/cash-and-reserves", icon: Wallet, label: "Cash and Reserves", group: "Portfolio" },
  { href: "/expenses", icon: Landmark, label: "Expenses", group: "Planning" },
  { href: "/debt", icon: CreditCard, label: "Debt", group: "Planning" },
  { href: "/goals", icon: Target, label: "Goals", group: "Planning" },
  { href: "/market-approvals", icon: ClipboardCheck, label: "Market Approvals", group: "Account" },
  { href: "/settings", icon: Settings, label: "Settings", group: "Account" },
];
const navGroups: NavItem["group"][] = ["Overview", "Portfolio", "Planning", "Account"];

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SafeUser;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const initials = useMemo(() => getInitials(user.fullName), [user.fullName]);
  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="wc-protected min-h-svh bg-[#f5f7fb]">
      {mobileOpen ? (
        <button
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-30 bg-black/25 md:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[16.5rem] flex-col border-r border-[#e6ebf2] bg-white transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-[115%] md:translate-x-0",
          "shadow-[18px_0_60px_rgba(15,23,42,0.08)] md:shadow-none",
        )}
      >
        <div className="flex h-[4.5rem] items-center border-b border-[#e6ebf2] px-6">
          <Link
            className="flex min-w-0 items-center gap-3"
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
          >
            <BankDashLogo />
          </Link>
        </div>

        <button
          aria-label="Close navigation"
          className="absolute right-4 top-7 flex size-10 items-center justify-center rounded-2xl border border-black/5 text-neutral-500 transition hover:bg-neutral-100 md:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        >
          <X className="size-4" />
        </button>

        <nav className="flex flex-1 flex-col overflow-y-auto px-4 py-5">
          <div className="flex flex-col gap-5">
            {navGroups.map((group) => (
              <div key={group}>
                <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  {group}
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  {navItems
                    .filter((item) => item.group === group)
                    .map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                      return (
                        <Link
                          key={item.href}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[0.95rem] font-medium text-neutral-500 transition hover:bg-[#f5f7fb] hover:text-neutral-950",
                            active && "bg-[#111111] text-white shadow-[0_10px_28px_rgba(17,17,17,0.14)] hover:bg-[#111111] hover:text-white",
                          )}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                        >
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f4f7fb] text-neutral-500 transition group-hover:bg-white group-hover:text-neutral-950",
                              active && "bg-white/12 text-white group-hover:bg-white/12 group-hover:text-white",
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-[#e6ebf2] p-4">
          <div className="rounded-2xl bg-[#f8fafc] px-4 py-3">
            <p className="truncate text-sm font-semibold text-neutral-950">{user.fullName}</p>
            <p className="mt-0.5 truncate text-xs text-neutral-500">{user.email}</p>
          </div>
        </div>
      </aside>

      <div className="min-h-svh md:pl-[16.5rem]">
        <header className="sticky top-0 z-20 flex h-[4.5rem] items-center justify-between border-b border-[#e6ebf2] bg-white/90 px-4 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-4">
            <button
              aria-label="Open navigation"
              className="flex size-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-100 md:hidden"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu className="size-5" />
            </button>
            <h1 className="truncate text-[1.25rem] font-semibold tracking-tight text-neutral-950 sm:text-[1.7rem]">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-neutral-950">{user.fullName}</p>
              <p className="text-xs text-neutral-500">Primary account</p>
            </div>
            <div className="relative" ref={accountMenuRef}>
              <button
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                aria-label="Open account menu"
                className="flex size-11 items-center justify-center rounded-2xl bg-[#111111] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(17,17,17,0.18)] transition hover:opacity-90 sm:size-12 sm:rounded-full"
                onClick={() => setAccountMenuOpen((current) => !current)}
                type="button"
              >
                {initials}
              </button>

              {accountMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 min-w-56 rounded-2xl border border-[#e6ebf2] bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
                  <div className="border-b border-[#eef2f7] px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-neutral-950">{user.fullName}</p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{user.email}</p>
                  </div>
                  <Link
                    className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
                    href="/settings"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <Settings className="size-4 shrink-0" />
                    <span>Settings</span>
                  </Link>
                  <form action="/api/signout" method="post">
                    <button
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
                      type="submit"
                    >
                      <LogOut className="size-4 shrink-0" />
                      <span>Logout</span>
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="h-[calc(100svh-4.5rem)]">{children}</main>
      </div>
    </div>
  );
}

function BankDashLogo() {
  return (
    <>
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-white shadow-sm">
        <Compass className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg leading-tight font-semibold tracking-tight text-neutral-950">
          Wealth Compass
        </p>
      </div>
    </>
  );
}

function getPageTitle(pathname: string) {
  if (pathname === "/dashboard") {
    return "Overview";
  }

  return navItems.find((item) => item.href === pathname)?.label ?? "Overview";
}

function getInitials(fullName: string) {
  const [first = "", second = ""] = fullName.trim().split(/\s+/);

  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase() || "WC";
}
