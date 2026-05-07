"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Coins,
  Compass,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
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
  { href: "/cash-and-reserves", icon: Wallet, label: "Cash and Reserves" },
  { href: "/goals", icon: Target, label: "Goals" },
];

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SafeUser;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = useMemo(() => getInitials(user.fullName), [user.fullName]);

  return (
    <div className="min-h-svh bg-[linear-gradient(180deg,#f7f7f4_0%,#edf1ea_100%)] p-2.5 sm:p-4">
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
          "fixed inset-y-2.5 left-2.5 z-40 flex h-[calc(100svh-1.25rem)] flex-col rounded-[1.8rem] border border-black/5 bg-white/92 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur transition-all duration-300 md:inset-y-4 md:left-4 md:h-[calc(100svh-2rem)]",
          mobileOpen ? "translate-x-0" : "-translate-x-[115%] md:translate-x-0",
          collapsed ? "md:w-[5.5rem]" : "md:w-[17.5rem]",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-1 py-1.5",
            collapsed && "flex-col items-center justify-start",
          )}
        >
          <Link
            className={cn(
              "flex min-w-0 items-center gap-3",
              collapsed && "justify-center",
            )}
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-white shadow-sm">
              <Compass className="size-5" />
            </div>
            <div className={cn("min-w-0 flex-1", collapsed && "hidden")}>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
                Finance OS
              </p>
              <p className="text-lg leading-tight font-semibold tracking-tight text-neutral-950">
                Wealth Compass
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "hidden size-10 items-center justify-center rounded-2xl border border-black/5 text-neutral-500 transition hover:bg-neutral-100 md:flex",
                collapsed && "mt-1",
              )}
              onClick={() => setCollapsed((current) => !current)}
              type="button"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
            <button
              aria-label="Close navigation"
              className="flex size-10 items-center justify-center rounded-2xl border border-black/5 text-neutral-500 transition hover:bg-neutral-100 md:hidden"
              onClick={() => setMobileOpen(false)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <nav className="mt-5 flex flex-1 flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950",
                  active && "bg-[#f2f5ef] text-neutral-950 shadow-sm",
                  collapsed && "justify-center px-0",
                )}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="size-5 shrink-0" />
                <span className={cn("truncate", collapsed && "hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 space-y-2.5">
          <div
            className={cn(
              "rounded-[1.5rem] border border-black/5 bg-[#f7f7f4] p-3",
              collapsed && "px-0",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-3",
                collapsed && "justify-center",
              )}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-sm font-semibold text-white">
                {initials}
              </div>
              <div className={cn("min-w-0", collapsed && "hidden")}>
                <p className="truncate text-sm font-semibold text-neutral-950">
                  {user.fullName}
                </p>
                <p className="truncate text-xs text-neutral-500">{user.email}</p>
              </div>
            </div>
          </div>

          <form action="/api/signout" method="post">
            <button
              className={cn(
                "flex w-full items-center justify-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100",
                collapsed && "px-0",
              )}
              title={collapsed ? "Logout" : undefined}
              type="submit"
            >
              <LogOut className="size-4 shrink-0" />
              <span className={cn(collapsed && "hidden")}>Logout</span>
            </button>
          </form>
        </div>
      </aside>

      <div
        className={cn(
          "relative min-h-[calc(100svh-1.25rem)] rounded-[1.8rem] border border-black/5 bg-white/82 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur transition-[margin] duration-300 md:min-h-[calc(100svh-2rem)]",
          collapsed ? "md:ml-[6.75rem]" : "md:ml-[17.75rem]",
        )}
      >
        <button
          aria-label="Open navigation"
          className="absolute left-4 top-4 z-10 flex size-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-100 md:hidden"
          onClick={() => setMobileOpen(true)}
          type="button"
        >
          <Menu className="size-5" />
        </button>

        <main className="p-3 pt-14 sm:p-4 sm:pt-4 md:p-4">{children}</main>
      </div>
    </div>
  );
}

function getInitials(fullName: string) {
  const [first = "", second = ""] = fullName.trim().split(/\s+/);

  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase() || "WC";
}
