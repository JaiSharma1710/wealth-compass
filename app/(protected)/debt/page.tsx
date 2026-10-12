import { DebtView } from "@/components/debt-view";
import { requireCurrentUser } from "@/lib/auth";
import { getDebtPageData } from "@/lib/debt";

export default async function DebtPage() {
  const user = await requireCurrentUser();
  const data = await getDebtPageData(user.id);

  return <DebtView currencyCode={user.profile.currency} initialData={data} />;
}
