"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Coins,
  Compass,
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
};

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/stocks", icon: LineChart, label: "Stocks" },
  { href: "/mutual-funds", icon: PieChart, label: "Mutual Funds" },
  { href: "/gold", icon: Coins, label: "Gold" },
  { href: "/expenses", icon: Landmark, label: "Expense Tracker" },
  { href: "/cash-and-reserves", icon: Wallet, label: "Cash and Reserves" },
  { href: "/goals", icon: Target, label: "Goals" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

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
    <div className="wc-protected min-h-svh bg-[linear-gradient(180deg,#f7f7f4_0%,#edf1ea_100%)]">
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
        )}
      >
        <div className="flex h-[4.5rem] items-center border-b border-[#e6ebf2] px-8">
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

        <nav className="flex flex-1 flex-col px-5 py-6">
          <div className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-2xl px-5 py-3 text-[1.02rem] font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950",
                    active && "bg-[#f2f5ef] text-neutral-950",
                  )}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                >
                  <span
                    className={cn(
                      "absolute left-[-1.25rem] top-1/2 h-11 w-1 -translate-y-1/2 rounded-r-full bg-transparent transition-colors",
                      active && "bg-[#111111]",
                    )}
                  />
                  <Icon className="size-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className="min-h-svh md:pl-[16.5rem]">
        <header className="sticky top-0 z-20 flex h-[4.5rem] items-center justify-between border-b border-[#e6ebf2] bg-white px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              aria-label="Open navigation"
              className="flex size-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-100 md:hidden"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu className="size-5" />
            </button>
            <h1 className="text-[1.5rem] font-semibold tracking-tight text-neutral-950 sm:text-[1.7rem]">
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
                className="flex size-12 items-center justify-center rounded-full bg-[#111111] text-sm font-semibold text-white transition hover:opacity-90"
                onClick={() => setAccountMenuOpen((current) => !current)}
                type="button"
              >
                {initials}
              </button>

              {accountMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 min-w-44 rounded-2xl border border-[#e6ebf2] bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
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
