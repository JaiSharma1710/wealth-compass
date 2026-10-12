import { describe, expect, it } from "vitest";

import { inferCategory, resolveCategory } from "@/lib/expense-categories";

describe("expense categories", () => {
  it("infers categories from common notes", () => {
    expect(inferCategory("expense", "cng")).toBe("transport");
    expect(inferCategory("expense", "Parking")).toBe("transport");
    expect(inferCategory("expense", "grocery")).toBe("groceries");
    expect(inferCategory("expense", "Lunch with team")).toBe("food");
    expect(inferCategory("expense", "golgappe")).toBe("food");
    expect(inferCategory("expense", "random thing")).toBe("other");
    expect(inferCategory("credit", "Salary Oct")).toBe("income");
  });

  it("prefers a valid stored category", () => {
    expect(resolveCategory("expense", "shopping", "cng")).toBe("shopping");
    expect(resolveCategory("expense", "income", "cng")).toBe("transport");
    expect(resolveCategory("expense", "", "cng")).toBe("transport");
  });
});
