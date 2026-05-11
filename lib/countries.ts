import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { Country } from "@/lib/models/country";

export type CountryRecord = {
  code: string;
  name: string;
};

export async function getCountryOptions() {
  await connectToDatabase();

  const countries = await Country.find({}, { _id: 0, code: 1, name: 1 })
    .sort({ name: 1 })
    .lean();

  return countries
    .map((country) => ({
      code: String(country.code || "").trim().toUpperCase(),
      name: String(country.name || "").trim(),
    }))
    .filter((country) => country.code && country.name);
}

export async function findCountryOption(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  const options = await getCountryOptions();
  const lowerValue = normalizedValue.toLowerCase();

  return (
    options.find((country) => country.code === normalizedValue.toUpperCase()) ||
    options.find((country) => country.name.toLowerCase() === lowerValue) ||
    null
  );
}
