import { describe, expect, it } from "vitest";

import { normalizeSovereignGoldBondResponse } from "@/lib/services/nse-sgb.service";

describe("NSE sovereign gold bond service", () => {
  it("normalizes NSE SGB rows into usable quotes", () => {
    const quotes = normalizeSovereignGoldBondResponse({
      timestamp: "28-Aug-2026 16:00:00",
      data: [
        {
          symbol: "SGBFEB32IV",
          ltP: "16080",
          chn: "19.96",
          per: "0.12",
          prevClose: "16060.04",
          issue_price: "6213",
          maturityDate: "B32IV",
        },
        {
          symbol: "SGBJAN27",
          ltP: "15,973.98",
          chn: "0",
          per: "0.00",
          prevClose: "15973.98",
          issue_price: "3164",
          maturityDate: "JAN27",
        },
        {
          symbol: "BROKEN",
          ltP: "0",
        },
      ],
    });

    expect(quotes).toEqual([
      {
        symbol: "SGBFEB32IV",
        lastPrice: 16080,
        change: 19.96,
        changePercent: 0.12,
        previousClose: 16060.04,
        issuePrice: 6213,
        maturityDate: "B32IV",
        fetchedAt: "28-Aug-2026 16:00:00",
      },
      {
        symbol: "SGBJAN27",
        lastPrice: 15973.98,
        change: 0,
        changePercent: 0,
        previousClose: 15973.98,
        issuePrice: 3164,
        maturityDate: "JAN27",
        fetchedAt: "28-Aug-2026 16:00:00",
      },
    ]);
  });
});
