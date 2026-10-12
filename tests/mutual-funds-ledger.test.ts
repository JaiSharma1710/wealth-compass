import { describe, expect, it } from "vitest";

import { findOversell, validateTransactionRemoval, type LedgerEntry } from "@/lib/mutual-funds-ledger";

const entries: LedgerEntry[] = [
  { id: "b1", schemeCode: 1, transactionType: "buy", units: 10, date: "2025-01-01" },
  { id: "b2", schemeCode: 1, transactionType: "buy", units: 5, date: "2025-02-01" },
  { id: "s1", schemeCode: 1, transactionType: "sell", units: 12, date: "2025-03-01" },
  { id: "b3", schemeCode: 2, transactionType: "buy", units: 3, date: "2025-01-15" },
];

describe("mutual fund ledger validation", () => {
  it("accepts a consistent ledger", () => {
    expect(findOversell(entries)).toBeNull();
  });

  it("refuses removing a buy that a later sell depends on", () => {
    expect(validateTransactionRemoval(entries, "b2")).toMatch(/later sale/);
  });

  it("allows removing a sell or an unrelated buy", () => {
    expect(validateTransactionRemoval(entries, "s1")).toBeNull();
    expect(validateTransactionRemoval(entries, "b3")).toBeNull();
  });

  it("reports unknown transactions", () => {
    expect(validateTransactionRemoval(entries, "nope")).toBe("Transaction not found.");
  });

  it("detects a sell before any buy", () => {
    const bad: LedgerEntry[] = [
      { id: "s", schemeCode: 1, transactionType: "sell", units: 1, date: "2025-01-01" },
      { id: "b", schemeCode: 1, transactionType: "buy", units: 1, date: "2025-02-01" },
    ];
    expect(findOversell(bad)?.id).toBe("s");
  });
});
