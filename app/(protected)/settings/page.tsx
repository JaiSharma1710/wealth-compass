import { SettingsForm } from "@/components/settings-form";
import { requireCurrentUser } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await requireCurrentUser();

  return <SettingsForm user={user} />;
}
