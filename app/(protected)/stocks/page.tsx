import { StocksPageClient } from "@/components/stocks-page-client";
import { requireCurrentUser } from "@/lib/auth";

export default async function StocksPage() {
  const user = await requireCurrentUser();

  return <StocksPageClient currencyCode={user.profile.currency} />;
}
