import { CashReservesView } from "@/components/cash-reserves-view";
import { requireCurrentUser } from "@/lib/auth";
import { getCashReserveDashboard } from "@/lib/cash-reserves";

export default async function CashAndReservesPage() {
  const user = await requireCurrentUser();
  const dashboard = await getCashReserveDashboard(user.id);

  return (
    <CashReservesView
      currencyCode={user.profile.currency}
      initialData={dashboard}
    />
  );
}
