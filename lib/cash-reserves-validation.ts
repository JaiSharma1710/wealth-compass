export type LedgerEntry = {
  id?: string;
  /** yyyy-mm-dd */
  dateKey: string;
  amount: number;
  entryType: "credit" | "debit";
  bank: string;
};

export type NegativeBalanceViolation = {
  bank: string;
  dateKey: string;
  balance: number;
};

/**
 * Replays the ledger in date order (credits before debits within a day, since entries only
 * carry a date) and returns the first point where a bank balance would drop below zero.
 * Pass `banks` to only check those banks (so unrelated, pre-existing issues do not block a change).
 */
export function findNegativeBalance(
  entries: LedgerEntry[],
  banks?: string[]
): NegativeBalanceViolation | null {
  const watched = banks ? new Set(banks) : null;
  const ordered = [...entries].sort((left, right) => {
    if (left.dateKey !== right.dateKey) return left.dateKey < right.dateKey ? -1 : 1;
    if (left.entryType === right.entryType) return 0;
    return left.entryType === "credit" ? -1 : 1;
  });
  const balances = new Map<string, number>();

  for (let index = 0; index < ordered.length; index += 1) {
    const entry = ordered[index];
    const next = Math.round(((balances.get(entry.bank) || 0) + (entry.entryType === "credit" ? entry.amount : -entry.amount)) * 100) / 100;

    balances.set(entry.bank, next);

    const dayEnds = index === ordered.length - 1 || ordered[index + 1].dateKey !== entry.dateKey;

    if (next < 0 && (dayEnds || entry.entryType === "debit") && (!watched || watched.has(entry.bank))) {
      return { bank: entry.bank, dateKey: entry.dateKey, balance: next };
    }
  }

  return null;
}

export type LedgerChange =
  | { kind: "add"; entries: LedgerEntry[] }
  | { kind: "update"; id: string; entry: LedgerEntry }
  | { kind: "delete"; id: string };

/** Applies a change to the ledger and reports a violation on any bank the change touches. */
export function validateLedgerChange(
  ledger: LedgerEntry[],
  change: LedgerChange
): NegativeBalanceViolation | null {
  let next: LedgerEntry[];
  const touched = new Set<string>();

  if (change.kind === "add") {
    next = [...ledger, ...change.entries];
    change.entries.forEach((entry) => touched.add(entry.bank));
  } else if (change.kind === "update") {
    const existing = ledger.find((entry) => entry.id === change.id);
    if (existing) touched.add(existing.bank);
    touched.add(change.entry.bank);
    next = ledger.map((entry) => (entry.id === change.id ? { ...change.entry, id: change.id } : entry));
  } else {
    const existing = ledger.find((entry) => entry.id === change.id);
    if (existing) touched.add(existing.bank);
    next = ledger.filter((entry) => entry.id !== change.id);
  }

  return findNegativeBalance(next, [...touched]);
}

export function describeViolation(violation: NegativeBalanceViolation) {
  return `This would leave ${violation.bank} with a negative balance on ${violation.dateKey}.`;
}
