import { ExpensesView } from "@/components/expenses-view";
import { requireCurrentUser } from "@/lib/auth";
import { getExpenseDashboard } from "@/lib/expenses";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const user = await requireCurrentUser();
  const dashboard = await getExpenseDashboard(user.id);

  return <ExpensesView currencyCode={user.profile.currency || "INR"} initialData={dashboard} />;
}
