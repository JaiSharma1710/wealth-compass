import { MutualFundsView } from "@/components/mutual-funds-view";
import { requireCurrentUser } from "@/lib/auth";
import { getMutualFundDashboard } from "@/lib/mutual-funds";

export const dynamic = "force-dynamic";

export default async function MutualFundsPage() {
  const user = await requireCurrentUser();
  const data = await getMutualFundDashboard(user.id);

  return <MutualFundsView data={data} currencyCode={user.profile.currency || "INR"} />;
}
