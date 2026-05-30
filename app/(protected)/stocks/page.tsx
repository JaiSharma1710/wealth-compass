import { StocksView } from "@/components/stocks-view";
import { requireCurrentUser } from "@/lib/auth";
import { getStockDashboard } from "@/lib/stocks";

export default async function StocksPage() {
  const user = await requireCurrentUser();
  const dashboard = await getStockDashboard(user.id);

  return (
    <StocksView
      currencyCode={user.profile.currency}
      initialData={dashboard}
    />
  );
}
