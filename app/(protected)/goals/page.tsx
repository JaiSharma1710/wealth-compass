import { GoalsView } from "@/components/goals-view";
import { requireCurrentUser } from "@/lib/auth";
import { getGoalsPageData } from "@/lib/goals";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await requireCurrentUser();
  const data = await getGoalsPageData(user);

  return <GoalsView currencyCode={user.profile.currency || "INR"} data={data} />;
}
