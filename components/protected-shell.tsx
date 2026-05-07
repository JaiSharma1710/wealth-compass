import type { SafeUser } from "@/lib/auth";

import { DashboardShell } from "@/components/dashboard-shell";

export function ProtectedShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SafeUser;
}) {
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
