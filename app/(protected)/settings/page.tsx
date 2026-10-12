import { SettingsForm } from "@/components/settings-form";
import { requireCurrentUser } from "@/lib/auth";
import { getCountryOptions } from "@/lib/countries";
import { getCurrencyOptions } from "@/lib/currencies";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireCurrentUser();
  const [countries, currencies] = await Promise.all([
    getCountryOptions().catch(() => []),
    getCurrencyOptions().catch(() => []),
  ]);

  return <SettingsForm countries={countries} currencies={currencies} user={user} />;
}
