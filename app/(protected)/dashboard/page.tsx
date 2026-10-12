import { DashboardView } from "@/components/dashboard-view";
import { requireCurrentUser } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const data = await getDashboard(user);

  return <DashboardView data={data} currencyCode={user.profile.currency || "INR"} />;
}
