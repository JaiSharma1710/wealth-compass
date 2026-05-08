import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export type CountryRecord = {
  code: string;
  name: string;
};

export async function getCountryOptions() {
  const connection = await connectToDatabase();
  const db = connection.connection.db;

  if (!db) {
    throw new Error("Database connection is not available.");
  }

  const countries = await db
    .collection("countries")
    .find({}, { projection: { _id: 0, code: 1, name: 1 } })
    .sort({ name: 1 })
    .toArray();

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
