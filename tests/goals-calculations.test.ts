import { describe, expect, it } from "vitest";

import { calculateGoalProgress, normalizeGoalLinks, resolveGoalLinks } from "@/lib/goals-calculations";
import type { GoalAssetGroup } from "@/lib/goals.types";

const created = new Date("2026-01-01T00:00:00Z");
const now = new Date("2026-07-01T00:00:00Z");

describe("calculateGoalProgress", () => {
  it("computes progress, remaining and required monthly saving", () => {
    const result = calculateGoalProgress({
      targetAmount: 120000,
      currentValue: 60000,
      targetDate: new Date("2027-01-01T00:00:00Z"),
      createdAt: created,
      now,
    });

    expect(result.progressPct).toBe(50);
    expect(result.remainingAmount).toBe(60000);
    expect(result.monthsLeft).toBe(6);
    expect(result.requiredMonthly).toBe(10000);
    expect(result.status).toBe("on_track");
  });

  it("flags a goal as behind when progress trails the straight-line plan", () => {
    const result = calculateGoalProgress({
      targetAmount: 100000,
      currentValue: 10000,
      targetDate: new Date("2027-01-01T00:00:00Z"),
      createdAt: created,
      now,
    });

    expect(result.status).toBe("behind");
  });

  it("handles completed, overdue and no-date goals", () => {
    expect(calculateGoalProgress({ targetAmount: 100, currentValue: 150, targetDate: null, createdAt: created, now })).toMatchObject({
      status: "completed",
      progressPct: 100,
      remainingAmount: 0,
      requiredMonthly: null,
    });
    expect(calculateGoalProgress({ targetAmount: 100, currentValue: 10, targetDate: new Date("2026-03-01"), createdAt: created, now }).status).toBe("overdue");
    expect(calculateGoalProgress({ targetAmount: 100, currentValue: 10, targetDate: null, createdAt: created, now })).toMatchObject({
      status: "no_date",
      requiredMonthly: null,
    });
  });
});

describe("goal links", () => {
  const groups: GoalAssetGroup[] = [
    {
      assetType: "mutual_fund",
      label: "Mutual Funds",
      description: "",
      available: true,
      emptyMessage: "",
      options: [
        { assetType: "mutual_fund", assetTypeLabel: "Mutual Fund", investmentId: "*", investmentLabel: "All mutual funds", investmentDetail: "", currentValue: 300, isAvailable: true, isWholeClass: true },
        { assetType: "mutual_fund", assetTypeLabel: "Mutual Fund", investmentId: "1", investmentLabel: "Fund A", investmentDetail: "", currentValue: 100, isAvailable: true, isWholeClass: false },
      ],
    },
  ];

  it("does not double count an individual link covered by a whole-class link", () => {
    const result = resolveGoalLinks(
      [
        { assetType: "mutual_fund", investmentId: "*" },
        { assetType: "mutual_fund", investmentId: "1" },
      ],
      groups
    );

    expect(result.currentValue).toBe(300);
    expect(result.links[1].isCounted).toBe(false);
  });

  it("treats legacy single-investment goals as a one-item links array", () => {
    expect(normalizeGoalLinks({ assetType: "gold", investmentId: "abc" })).toEqual([{ assetType: "gold", investmentId: "abc" }]);
    expect(normalizeGoalLinks({ links: [], assetType: null })).toEqual([]);
  });
});
