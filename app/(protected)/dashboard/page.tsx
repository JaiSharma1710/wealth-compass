import { DashboardPageClient } from "@/components/dashboard-page-client";
import { requireCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireCurrentUser();

  return <DashboardPageClient currencyCode={user.profile.currency} />;
}
