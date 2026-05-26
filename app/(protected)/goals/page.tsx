import { GoalsView } from "@/components/goals-view";
import { requireCurrentUser } from "@/lib/auth";
import { getGoalsPageData } from "@/lib/goals";

export default async function GoalsPage() {
  const user = await requireCurrentUser();
  const data = await getGoalsPageData(user);

  return <GoalsView currencyCode={user.profile.currency} initialData={data} />;
}
