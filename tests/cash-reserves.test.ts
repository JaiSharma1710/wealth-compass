import { describe, expect, it } from "vitest";

import { findNegativeBalance, validateLedgerChange, type LedgerEntry } from "@/lib/cash-reserves-validation";

const ledger: LedgerEntry[] = [
  { id: "a", dateKey: "2026-01-01", amount: 1000, entryType: "credit", bank: "HDFC" },
  { id: "b", dateKey: "2026-02-01", amount: 400, entryType: "debit", bank: "HDFC" },
  { id: "c", dateKey: "2026-02-01", amount: 50, entryType: "credit", bank: "BOI" },
];

describe("cash reserve ledger validation", () => {
  it("accepts a healthy ledger", () => {
    expect(findNegativeBalance(ledger)).toBeNull();
  });

  it("allows same-day credit then debit regardless of order", () => {
    const entries: LedgerEntry[] = [
      { dateKey: "2026-03-01", amount: 100, entryType: "debit", bank: "X" },
      { dateKey: "2026-03-01", amount: 100, entryType: "credit", bank: "X" },
    ];
    expect(findNegativeBalance(entries)).toBeNull();
  });

  it("refuses deleting a credit that funds later debits", () => {
    const violation = validateLedgerChange(ledger, { kind: "delete", id: "a" });
    expect(violation).toMatchObject({ bank: "HDFC", dateKey: "2026-02-01", balance: -400 });
  });

  it("refuses moving a credit after the debit", () => {
    const violation = validateLedgerChange(ledger, {
      kind: "update",
      id: "a",
      entry: { dateKey: "2026-03-01", amount: 1000, entryType: "credit", bank: "HDFC" },
    });
    expect(violation?.bank).toBe("HDFC");
  });

  it("allows deleting a debit and changing an unrelated entry", () => {
    expect(validateLedgerChange(ledger, { kind: "delete", id: "b" })).toBeNull();
    expect(
      validateLedgerChange(ledger, {
        kind: "update",
        id: "c",
        entry: { dateKey: "2026-02-01", amount: 10, entryType: "credit", bank: "BOI" },
      })
    ).toBeNull();
  });

  it("refuses a debit that exceeds the balance when added", () => {
    const violation = validateLedgerChange(ledger, {
      kind: "add",
      entries: [{ dateKey: "2026-02-02", amount: 700, entryType: "debit", bank: "HDFC" }],
    });
    expect(violation?.balance).toBe(-100);
  });

  it("ignores pre-existing violations on banks the change does not touch", () => {
    const broken: LedgerEntry[] = [...ledger, { id: "z", dateKey: "2026-01-02", amount: 5, entryType: "debit", bank: "Other" }];
    expect(validateLedgerChange(broken, { kind: "delete", id: "c" })).toBeNull();
  });
});
