import { describe, expect, it } from "vitest";

import { calculateXirr } from "@/lib/xirr";

describe("calculateXirr", () => {
  it("returns ~10% for a one-year 10% gain", () => {
    const result = calculateXirr([
      { amount: -1000, date: new Date("2025-01-01") },
      { amount: 1100, date: new Date("2026-01-01") },
    ]);

    expect(result).toBeCloseTo(10, 1);
  });

  it("handles multiple contributions (SIP style)", () => {
    const result = calculateXirr([
      { amount: -1000, date: new Date("2025-01-01") },
      { amount: -1000, date: new Date("2025-07-01") },
      { amount: 2150, date: new Date("2026-01-01") },
    ]);

    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(9);
    expect(result!).toBeLessThan(11);
  });

  it("returns a negative rate for losses", () => {
    const result = calculateXirr([
      { amount: -1000, date: new Date("2025-01-01") },
      { amount: 800, date: new Date("2026-01-01") },
    ]);

    expect(result).toBeCloseTo(-20, 1);
  });

  it("returns null under a year by default, but allows a shorter minimum", () => {
    const flows = [
      { amount: -1000, date: new Date("2025-01-01") },
      { amount: 1100, date: new Date("2025-07-01") },
    ];

    expect(calculateXirr(flows)).toBeNull();
    expect(calculateXirr(flows, { minDays: 30 })).toBeGreaterThan(20);
  });

  it("returns null without both inflows and outflows or for very short periods", () => {
    expect(calculateXirr([{ amount: -1000, date: new Date("2025-01-01") }])).toBeNull();
    expect(
      calculateXirr([
        { amount: -1000, date: new Date("2025-01-01") },
        { amount: 1010, date: new Date("2025-01-10") },
      ])
    ).toBeNull();
  });
});
