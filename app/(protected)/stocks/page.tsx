import { StocksView } from "@/components/stocks-view";
import { requireCurrentUser } from "@/lib/auth";
import { getStockDashboard } from "@/lib/stocks";

export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const user = await requireCurrentUser();
  const data = await getStockDashboard(user.id);

  return <StocksView initialData={data} currencyCode={user.profile.currency || "INR"} />;
}
