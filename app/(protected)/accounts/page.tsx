import { AccountsView } from "@/components/accounts-view";
import { requireCurrentUser } from "@/lib/auth";
import { getAccountsDashboard } from "@/lib/accounts";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await requireCurrentUser();
  const data = await getAccountsDashboard(user.id);

  return <AccountsView data={data} currencyCode={user.profile.currency || "INR"} />;
}
