import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/models/gold-transaction", () => ({ GoldTransaction: {} }));

import { buildGoldValueSeries } from "@/lib/gold";

type Tx = Parameters<typeof buildGoldValueSeries>[0][number];

let seq = 0;
function tx(partial: Partial<Tx> & Pick<Tx, "transactionType" | "schemeName" | "transactionDate">): Tx {
  seq += 1;
  return {
    _id: String(seq),
    investmentOption: "sovereign_gold_bond",
    createdAt: new Date(2026, 0, 1, 0, 0, seq),
    ...partial,
  } as Tx;
}

describe("buildGoldValueSeries", () => {
  it("carries each holding's last value forward and sums across holdings", () => {
    const series = buildGoldValueSeries([
      tx({ transactionType: "buy", schemeName: "A", transactionDate: new Date(2026, 0, 1), investedAmount: 100, currentValue: 100 }),
      tx({ transactionType: "buy", schemeName: "B", transactionDate: new Date(2026, 0, 2), investedAmount: 200, currentValue: 200 }),
      tx({ transactionType: "valuation", schemeName: "A", transactionDate: new Date(2026, 0, 3), currentValue: 120 }),
      tx({ transactionType: "valuation", schemeName: "B", transactionDate: new Date(2026, 0, 4), currentValue: 210 }),
    ]);

    expect(series.map((point) => [point.date, point.totalValue, point.totalInvested])).toEqual([
      ["2026-01-01", 100, 100],
      ["2026-01-02", 300, 300],
      ["2026-01-03", 320, 300],
      ["2026-01-04", 330, 300],
    ]);
  });

  it("drops fully sold holdings and returns an empty series for no data", () => {
    expect(buildGoldValueSeries([])).toEqual([]);

    const series = buildGoldValueSeries([
      tx({ transactionType: "buy", schemeName: "A", transactionDate: new Date(2026, 0, 1), investedAmount: 100, currentValue: 100 }),
      tx({ transactionType: "sell", schemeName: "A", transactionDate: new Date(2026, 0, 2), sellAmount: 100 }),
    ]);

    expect(series).toEqual([{ date: "2026-01-01", totalValue: 100, totalInvested: 100 }]);
  });
});
