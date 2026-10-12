import { GoldView } from "@/components/gold-view";
import { requireCurrentUser } from "@/lib/auth";
import { getGoldDashboard } from "@/lib/gold";
import { listGoldTrackers } from "@/lib/gold-tracking";

export const dynamic = "force-dynamic";

export default async function GoldPage() {
  const user = await requireCurrentUser();
  const [data, trackers] = await Promise.all([
    getGoldDashboard(user.id),
    listGoldTrackers(user.id).catch(() => []),
  ]);

  return <GoldView currencyCode={user.profile.currency || "INR"} data={data} trackers={trackers} />;
}
