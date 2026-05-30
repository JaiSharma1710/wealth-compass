import { StockDetailView } from "@/components/stock-detail-view";
import { requireCurrentUser } from "@/lib/auth";
import { getStockDetail } from "@/lib/stocks";

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const user = await requireCurrentUser();
  const { symbol } = await params;
  const detail = await getStockDetail(user.id, decodeURIComponent(symbol));

  return (
    <StockDetailView
      currencyCode={user.profile.currency}
      initialData={detail}
    />
  );
}
