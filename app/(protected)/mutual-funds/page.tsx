import { MutualFundsView } from "@/components/mutual-funds-view";
import { requireCurrentUser } from "@/lib/auth";
import { getMutualFundDashboard } from "@/lib/mutual-funds";

export default async function MutualFundsPage() {
  const user = await requireCurrentUser();
  const dashboard = await getMutualFundDashboard(user.id);

  return (
    <MutualFundsView
      currencyCode={user.profile.currency}
      initialData={dashboard}
    />
  );
}
