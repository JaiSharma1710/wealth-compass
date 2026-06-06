import { MutualFundsPageClient } from "@/components/mutual-funds-page-client";
import { requireCurrentUser } from "@/lib/auth";

export default async function MutualFundsPage() {
  const user = await requireCurrentUser();

  return <MutualFundsPageClient currencyCode={user.profile.currency} />;
}
