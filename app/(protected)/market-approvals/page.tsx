import { MarketApprovalsView } from "@/components/market-approvals-view";
import { requireCurrentUser } from "@/lib/auth";

export default async function MarketApprovalsPage() {
  const user = await requireCurrentUser();

  return <MarketApprovalsView currencyCode={user.profile.currency} />;
}
