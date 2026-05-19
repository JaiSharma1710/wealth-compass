import { GoldView } from "@/components/gold-view";
import { requireCurrentUser } from "@/lib/auth";
import { getGoldDashboard } from "@/lib/gold";

export default async function GoldPage() {
  const user = await requireCurrentUser();
  const dashboard = await getGoldDashboard(user.id);

  return (
    <GoldView
      currencyCode={user.profile.currency}
      initialData={dashboard}
    />
  );
}
