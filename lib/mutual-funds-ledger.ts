export type LedgerEntry = {
  id: string;
  schemeCode: number;
  transactionType: "buy" | "sell";
  units: number;
  date: Date | string | number;
};

const EPSILON = 0.0001;

/**
 * Checks that replaying the given transactions (chronologically) never sells more
 * units than are held at that point. Returns the first offending entry, or null.
 */
export function findOversell(entries: LedgerEntry[]): LedgerEntry | null {
  const sorted = entries
    .map((entry, index) => ({ entry, index, time: new Date(entry.date).getTime() }))
    .sort((a, b) => a.time - b.time || a.index - b.index);
  const units = new Map<number, number>();

  for (const { entry } of sorted) {
    const held = units.get(entry.schemeCode) ?? 0;

    if (entry.transactionType === "buy") {
      units.set(entry.schemeCode, held + entry.units);
      continue;
    }

    if (entry.units > held + EPSILON) {
      return entry;
    }

    units.set(entry.schemeCode, held - entry.units);
  }

  return null;
}

/** Validates that removing `id` keeps the ledger consistent. Returns an error message or null. */
export function validateTransactionRemoval(entries: LedgerEntry[], id: string): string | null {
  if (!entries.some((entry) => entry.id === id)) {
    return "Transaction not found.";
  }

  const offender = findOversell(entries.filter((entry) => entry.id !== id));

  return offender
    ? "This purchase can't be deleted because a later sale would then exceed the units held. Delete that sale first."
    : null;
}
