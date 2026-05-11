import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { CurrencyCatalog, type CurrencyEntry } from "@/lib/models/currency";

export type CurrencyRecord = {
  code: string;
  name: string;
  symbol: string;
};

export async function getCurrencyOptions() {
  await connectToDatabase();

  const rawDocument = (await CurrencyCatalog.findOne({}, { _id: 0 }).lean()) as
    | Record<string, unknown>
    | null;

  if (!rawDocument) {
    return [] satisfies CurrencyRecord[];
  }

  return Object.values(rawDocument)
    .map((entry) => entry as CurrencyEntry)
    .map((entry) => ({
      code: String(entry.code || "").trim().toUpperCase(),
      name: String(entry.name || "").trim(),
      symbol: String(entry.symbol || "").trim(),
    }))
    .filter((currency) => currency.code && currency.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function findCurrencyOption(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  const options = await getCurrencyOptions();
  const lowerValue = normalizedValue.toLowerCase();

  return (
    options.find((currency) => currency.code === normalizedValue.toUpperCase()) ||
    options.find((currency) => currency.name.toLowerCase() === lowerValue) ||
    null
  );
}
