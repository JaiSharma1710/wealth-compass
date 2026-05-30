import { DashboardView } from "@/components/dashboard-view";
import { requireCurrentUser } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const dashboard = await getDashboard(user);

  return (
    <DashboardView
      currencyCode={user.profile.currency}
      initialData={dashboard}
    />
  );
}
