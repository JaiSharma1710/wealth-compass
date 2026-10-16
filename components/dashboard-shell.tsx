"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Coins,
  Compass,
  Landmark,
  LayoutDashboard,
  LineChart,
  LogOut,
  Moon,
  MoreHorizontal,
  Newspaper,
  PieChart,
  ReceiptText,
  Scale,
  Settings,
  Sparkles,
  Sun,
  Target,
  Wallet,
} from "lucide-react";

import { SyncStatus } from "@/components/sync-status";
import { Sheet } from "@/components/ui/sheet";
import type { SafeUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Short label for the phone tab bar. */
  short?: string;
};

const navGroups: Array<{ title: string | null; items: NavItem[] }> = [
  {
    title: null,
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Overview", short: "Home" },
      { href: "/advisor", icon: Sparkles, label: "AI Advisor" },
    ],
  },
  {
    title: "Investments",
    items: [
      { href: "/stocks", icon: LineChart, label: "Stocks", short: "Stocks" },
      { href: "/mutual-funds", icon: PieChart, label: "Mutual Funds", short: "Funds" },
      { href: "/gold", icon: Coins, label: "Gold" },
      { href: "/news", icon: Newspaper, label: "Market News" },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/expenses", icon: ReceiptText, label: "Expenses", short: "Spends" },
      { href: "/cash-and-reserves", icon: Wallet, label: "Cash & Savings" },
      { href: "/debt", icon: Landmark, label: "Loans & EMIs" },
      { href: "/accounts", icon: Scale, label: "Other Assets" },
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/goals", icon: Target, label: "Goals" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

const allItems = navGroups.flatMap((group) => group.items);
const tabItems = ["/dashboard", "/stocks", "/mutual-funds", "/expenses"].map(
  (href) => allItems.find((item) => item.href === href)!
);
const moreItems = allItems.filter((item) => !tabItems.includes(item));

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({ children, user }: { children: React.ReactNode; user: SafeUser }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const initials = useMemo(() => getInitials(user.fullName), [user.fullName]);
  const current = allItems.find((item) => isActive(pathname, item.href));
  const moreActive = moreItems.some((item) => isActive(pathname, item.href));

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div className="min-h-svh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface md:flex">
        <Link href="/dashboard" className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-cta text-cta-ink">
            <Compass className="size-[1.1rem]" />
          </span>
          <span className="text-[0.95rem] font-semibold tracking-tight text-ink">Wealth Compass</span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
          {navGroups.map((group, index) => (
            <div key={group.title || index} className="mt-4 first:mt-1">
              {group.title ? (
                <p className="mb-1 px-3 text-[0.68rem] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                  {group.title}
                </p>
              ) : null}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "mb-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                      active ? "bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                    )}
                  >
                    <Icon className="size-[1.05rem] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-4">
          <div className="rounded-2xl bg-surface-2 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
            <p className="mt-0.5 truncate text-xs text-ink-3">{user.email}</p>
          </div>
        </div>
      </aside>

      <div className="flex h-svh flex-col md:pl-60">
        <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6 md:h-16 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-cta text-cta-ink md:hidden">
              <Compass className="size-4" />
            </span>
            <h1 className="truncate text-base font-semibold tracking-tight text-ink md:text-lg">
              {current?.label || "Overview"}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <SyncStatus />
            <ThemeToggle />
            <div className="relative" ref={accountMenuRef}>
              <button
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-ink transition hover:bg-line"
                onClick={() => setAccountMenuOpen((open) => !open)}
                type="button"
              >
                {initials}
              </button>

              {accountMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-xl"
                >
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
                    <p className="truncate text-xs text-ink-3">{user.email}</p>
                  </div>
                  <div className="my-1 h-px bg-line" />
                  <Link
                    href="/settings"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-2 transition hover:bg-surface-2 hover:text-ink"
                  >
                    <Settings className="size-4" /> Settings
                  </Link>
                  <form action="/api/signout" method="post">
                    <button
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-ink-2 transition hover:bg-surface-2 hover:text-loss"
                      type="submit"
                    >
                      <LogOut className="size-4" /> Log out
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1">{children}</main>
      </div>

      {/* Phone tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {tabItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[0.68rem] font-medium transition",
                  active ? "text-brand" : "text-ink-3"
                )}
              >
                <Icon className="size-5" />
                {item.short || item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[0.68rem] font-medium transition",
              moreActive ? "text-brand" : "text-ink-3"
            )}
          >
            <MoreHorizontal className="size-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More" size="sm">
        <div className="grid grid-cols-3 gap-2 pb-2">
          {moreItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-center text-xs font-medium transition",
                  active ? "border-brand/30 bg-brand-soft text-brand-ink" : "border-line text-ink-2 active:bg-surface-2"
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          <form action="/api/signout" method="post" className="contents">
            <button
              type="submit"
              className="flex flex-col items-center gap-2 rounded-2xl border border-line px-2 py-4 text-xs font-medium text-ink-2 active:bg-surface-2"
            >
              <LogOut className="size-5" />
              Log out
            </button>
          </form>
        </div>
      </Sheet>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDark(document.documentElement.classList.contains("dark")), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  }

  const Icon = dark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex size-9 items-center justify-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink"
    >
      <Icon className="size-[1.05rem]" />
    </button>
  );
}

function getInitials(fullName: string) {
  const [first = "", second = ""] = fullName.trim().split(/\s+/);
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase() || "WC";
}

