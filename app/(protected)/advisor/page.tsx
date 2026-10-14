import { AdvisorView } from "@/components/advisor-view";
import { getAdvisorMetrics, getAdvisorProfile } from "@/lib/advisor";
import { requireCurrentUser } from "@/lib/auth";
import { isGeminiConfigured } from "@/lib/services/gemini.service";

export const dynamic = "force-dynamic";

export default async function AdvisorPage() {
  const user = await requireCurrentUser();
  // Numbers render immediately; the AI commentary loads client-side (it can take a few seconds).
  const [metrics, profile] = await Promise.all([getAdvisorMetrics(user), getAdvisorProfile(user)]);

  return (
    <AdvisorView
      metrics={metrics}
      profile={profile}
      currencyCode={user.profile.currency || "INR"}
      aiEnabled={isGeminiConfigured()}
    />
  );
}
