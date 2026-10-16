# Wealth Compass model — signal backtest report

Generated 2026-10-14 · data to 2026-10 · universe: 100 NSE large/mid caps (NIFTY 100 + owner's holdings).

## Summary

- **Full model, 12-month horizon:** +63% of Buy/Sell calls were right. Buy calls rose +64% of the time (avg +9.4%) while the NIFTY averaged -0.1%; Sell calls fell +59% of the time (avg -1.1%).
- **₹1,00,000 following the full model since Jul 2024** became **₹1,09,070** (+9.1%), vs ₹91,066 in the NIFTY 50 and ₹99,051 holding every stock equally.
- **2007–today, trend signal only:** ₹1,00,000 became **₹21,18,858** (+17.4%/yr) vs ₹4,52,507 in the NIFTY (+8.2%/yr) — but holding the same stocks equally made ₹36,01,970 (+20.7%/yr). Price trend alone did not beat simply owning the same stocks, and its Sell calls were right only +31% of the time over 12 months: in a rising market, selling on weakness mostly misses rebounds. This is why trend carries only 5% weight in the full model.
- **Bottom line:** the fundamentals-led model has shown a real edge in its (short) test window; the long history shows that timing quality stocks on price alone does not add value. Treat Buy calls as a shortlist and Sell calls as a prompt to review, not an automatic exit.

## How to read this

- **Calls:** every month each stock gets a call from its model score at that time: **Buy** (score ≥ 65), **Hold** (50–64), **Sell** (< 50). Only information public on that date is used; annual results count 90 days after the year ends.
- **Success:** a Buy is correct if the stock was up after the horizon; a Sell is correct if it was down. The stricter test asks whether a Buy beat the NIFTY 50 and a Sell lagged it.
- **Portfolio:** start with ₹1,00,000, buy every Buy, keep Holds you already own, sell Sells, rebalance to equal weights monthly, 0.25% cost per trade.

## Part 1 — Full model (fundamentals + price), Jul 2024 → today

Yahoo's free data has 4 years of financial statements, so the full model can be tested from **Jul 2024** (27 months, 2800 stock-month calls). Calls whose horizon hasn't finished yet are not graded.

Call mix: BUY 1393 · HOLD 887 · SELL 520

### Accuracy

| Horizon | Calls graded | Buy calls · went up · beat NIFTY · avg return | Sell calls · went down · lagged NIFTY · avg return | Hold calls · went up · avg | Buy+Sell accuracy | NIFTY avg |
|---|---|---|---|---|---|---|
| 3 months | 2500 | 1236 · +51% · +53% · +1.3% | 484 · +54% · +54% · -0.5% | 780 · +42% · -1.5% | **+52%** | -0.9% |
| 6 months | 2200 | 1079 · +57% · +57% · +3.4% | 430 · +53% · +50% · -0.5% | 691 · +43% · -1.6% | **+56%** | -1.1% |
| 12 months | 1600 | 776 · +64% · +65% · +9.4% | 298 · +59% · +54% · -1.1% | 526 · +44% · -0.8% | **+63%** | -0.1% |

### ₹1,00,000 following the model

| Strategy | ₹1,00,000 became | Total return | CAGR | Worst drawdown |
|---|---|---|---|---|
| **Follow the model** | **₹1,09,070** | +9.1% | +3.9% | -17.5% |
| NIFTY 50 index (price, no dividends) | ₹91,066 | -8.9% | -4.1% | -14.8% |
| Hold every stock equally | ₹99,051 | -0.9% | -0.4% | -18.1% |

Average holdings: 55 stocks · 77 buys/sells.

| Month | Model portfolio | NIFTY 50 | Stocks held |
|---|---|---|---|
| 2024-08 | ₹1,01,621 | ₹1,01,141 | 50 |
| 2024-09 | ₹1,04,330 | ₹1,03,446 | 50 |
| 2024-10 | ₹96,647 | ₹97,011 | 50 |
| 2024-11 | ₹96,261 | ₹96,713 | 50 |
| 2024-12 | ₹95,821 | ₹94,764 | 50 |
| 2025-01 | ₹92,949 | ₹94,218 | 50 |
| 2025-02 | ₹86,024 | ₹88,672 | 50 |
| 2025-03 | ₹93,195 | ₹94,262 | 51 |
| 2025-04 | ₹96,032 | ₹97,527 | 51 |
| 2025-05 | ₹1,00,162 | ₹99,197 | 51 |
| 2025-06 | ₹1,04,562 | ₹1,02,268 | 51 |
| 2025-07 | ₹1,01,835 | ₹99,267 | 51 |
| 2025-08 | ₹1,01,330 | ₹97,899 | 57 |
| 2025-09 | ₹1,04,730 | ₹98,637 | 57 |
| 2025-10 | ₹1,09,369 | ₹1,03,090 | 57 |
| 2025-11 | ₹1,11,339 | ₹1,05,017 | 57 |
| 2025-12 | ₹1,10,866 | ₹1,04,723 | 57 |
| 2026-01 | ₹1,07,980 | ₹1,01,481 | 57 |
| 2026-02 | ₹1,11,421 | ₹1,00,912 | 57 |
| 2026-03 | ₹97,797 | ₹89,500 | 59 |
| 2026-04 | ₹1,07,812 | ₹96,178 | 60 |
| 2026-05 | ₹1,08,796 | ₹94,375 | 60 |
| 2026-06 | ₹1,10,115 | ₹95,650 | 60 |
| 2026-07 | ₹1,14,739 | ₹97,725 | 62 |
| 2026-08 | ₹1,15,980 | ₹96,510 | 64 |
| 2026-09 | ₹1,08,509 | ₹90,659 | 63 |
| 2026-10 | ₹1,09,070 | ₹91,066 | 63 |

### Call-by-call: top 20 stocks

Quarterly calls with the score and what the stock did over the next 6 and 12 months (✅ call was right · ❌ wrong · ⏳ not finished · Hold is not graded).

**RELIANCE**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 37 | SELL | -15.7% | -7.3% | ✅ |
| 2024-10 | 37 | SELL | +5.5% | +12.0% | ❌ |
| 2025-01 | 41 | SELL | +9.9% | +10.7% | ❌ |
| 2025-04 | 42 | SELL | +6.2% | +2.2% | ❌ |
| 2025-07 | 43 | SELL | +0.8% | -5.1% | ✅ |
| 2025-10 | 43 | SELL | -3.7% | -21.1% | ✅ |
| 2026-01 | 44 | SELL | -5.8% | — | ✅ |
| 2026-04 | 43 | SELL | -18.1% | — | ✅ |
| 2026-07 | 55 | HOLD | — | — | Hold |
| 2026-10 | 56 | HOLD | — | — | Hold |

**TCS**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 60 | HOLD | -4.3% | -28.4% | Hold |
| 2024-10 | 60 | HOLD | -11.4% | -20.3% | Hold |
| 2025-01 | 60 | HOLD | -25.2% | -21.4% | Hold |
| 2025-04 | 60 | HOLD | -10.0% | -25.9% | Hold |
| 2025-07 | 61 | HOLD | +5.1% | -18.9% | Hold |
| 2025-10 | 61 | HOLD | -17.6% | -22.6% | Hold |
| 2026-01 | 62 | HOLD | -22.8% | — | Hold |
| 2026-04 | 65 | BUY | -6.0% | — | ❌ |
| 2026-07 | 68 | BUY | — | — | ⏳ |
| 2026-10 | 70 | BUY | — | — | ⏳ |

**HDFCBANK**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 69 | BUY | +5.1% | +26.6% | ✅ |
| 2024-10 | 68 | BUY | +10.9% | +15.3% | ✅ |
| 2025-01 | 68 | BUY | +20.4% | +10.9% | ✅ |
| 2025-04 | 67 | BUY | +4.0% | -18.7% | ❌ |
| 2025-07 | 62 | HOLD | -7.9% | -24.6% | Hold |
| 2025-10 | 74 | BUY | -21.8% | -26.5% | ❌ |
| 2026-01 | 74 | BUY | -18.2% | — | ❌ |
| 2026-04 | 76 | BUY | -5.9% | — | ❌ |
| 2026-07 | 71 | BUY | — | — | ⏳ |
| 2026-10 | 72 | BUY | — | — | ⏳ |

**ICICIBANK**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 85 | BUY | +4.0% | +23.0% | ✅ |
| 2024-10 | 83 | BUY | +10.4% | +4.9% | ✅ |
| 2025-01 | 83 | BUY | +18.2% | +9.0% | ✅ |
| 2025-04 | 81 | BUY | -5.0% | -10.8% | ❌ |
| 2025-07 | 84 | BUY | -7.8% | -2.4% | ❌ |
| 2025-10 | 85 | BUY | -6.1% | +2.0% | ✅ |
| 2026-01 | 84 | BUY | +5.9% | — | ✅ |
| 2026-04 | 85 | BUY | +8.6% | — | ✅ |
| 2026-07 | 79 | BUY | — | — | ⏳ |
| 2026-10 | 79 | BUY | — | — | ⏳ |

**BHARTIARTL**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 41 | SELL | +9.6% | +30.1% | ❌ |
| 2024-10 | 40 | SELL | +15.6% | +28.5% | ❌ |
| 2025-01 | 40 | SELL | +18.7% | +22.1% | ❌ |
| 2025-04 | 39 | SELL | +11.1% | +2.0% | ❌ |
| 2025-07 | 72 | BUY | +2.8% | +4.3% | ✅ |
| 2025-10 | 71 | BUY | -8.2% | -11.0% | ❌ |
| 2026-01 | 71 | BUY | +1.4% | — | ✅ |
| 2026-04 | 70 | BUY | -3.1% | — | ❌ |
| 2026-07 | 75 | BUY | — | — | ⏳ |
| 2026-10 | 75 | BUY | — | — | ⏳ |

**INFY**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 47 | SELL | +1.8% | -17.2% | ✅ |
| 2024-10 | 47 | SELL | -14.6% | -13.2% | ✅ |
| 2025-01 | 47 | SELL | -18.6% | -10.1% | ✅ |
| 2025-04 | 45 | SELL | +1.7% | -18.9% | ✅ |
| 2025-07 | 43 | SELL | +10.4% | -22.3% | ✅ |
| 2025-10 | 44 | SELL | -20.3% | -26.8% | ✅ |
| 2026-01 | 45 | SELL | -29.6% | — | ✅ |
| 2026-04 | 42 | SELL | -8.2% | — | ✅ |
| 2026-07 | 43 | SELL | — | — | ⏳ |
| 2026-10 | 45 | SELL | — | — | ⏳ |

**SBIN**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 92 | BUY | -11.4% | -6.9% | ❌ |
| 2024-10 | 92 | BUY | -3.8% | +16.5% | ✅ |
| 2025-01 | 91 | BUY | +5.1% | +42.2% | ✅ |
| 2025-04 | 91 | BUY | +21.2% | +38.2% | ✅ |
| 2025-07 | 84 | BUY | +35.2% | +31.3% | ✅ |
| 2025-10 | 85 | BUY | +14.0% | +4.0% | ✅ |
| 2026-01 | 84 | BUY | -2.9% | — | ❌ |
| 2026-04 | 84 | BUY | -8.8% | — | ❌ |
| 2026-07 | 77 | BUY | — | — | ⏳ |
| 2026-10 | 80 | BUY | — | — | ⏳ |

**HINDUNILVR**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 48 | SELL | -7.7% | -4.7% | ✅ |
| 2024-10 | 48 | SELL | -6.3% | -0.3% | ✅ |
| 2025-01 | 47 | SELL | +3.2% | -2.1% | ✅ |
| 2025-04 | 48 | SELL | +6.4% | -2.1% | ✅ |
| 2025-07 | 46 | SELL | -5.1% | -15.1% | ✅ |
| 2025-10 | 47 | SELL | -8.0% | -22.6% | ✅ |
| 2026-01 | 46 | SELL | -10.5% | — | ✅ |
| 2026-04 | 46 | SELL | -15.8% | — | ✅ |
| 2026-07 | 58 | HOLD | — | — | Hold |
| 2026-10 | 60 | HOLD | — | — | Hold |

**ITC**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 54 | HOLD | -6.2% | -10.7% | Hold |
| 2024-10 | 55 | HOLD | -8.1% | -7.6% | Hold |
| 2025-01 | 55 | HOLD | -4.8% | -25.5% | Hold |
| 2025-04 | 54 | HOLD | +0.5% | -23.1% | Hold |
| 2025-07 | 75 | BUY | -21.8% | -28.5% | ❌ |
| 2025-10 | 76 | BUY | -23.5% | -34.9% | ❌ |
| 2026-01 | 77 | BUY | -8.5% | — | ❌ |
| 2026-04 | 77 | BUY | -14.9% | — | ❌ |
| 2026-07 | 60 | HOLD | — | — | Hold |
| 2026-10 | 61 | HOLD | — | — | Hold |

**LT**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 75 | BUY | -6.5% | -3.8% | ❌ |
| 2024-10 | 76 | BUY | -7.8% | +12.3% | ✅ |
| 2025-01 | 75 | BUY | +2.9% | +11.3% | ✅ |
| 2025-04 | 75 | BUY | +21.8% | +21.3% | ✅ |
| 2025-07 | 73 | BUY | +8.1% | +9.4% | ✅ |
| 2025-10 | 72 | BUY | -0.4% | -7.9% | ❌ |
| 2026-01 | 73 | BUY | +1.1% | — | ✅ |
| 2026-04 | 72 | BUY | -7.6% | — | ❌ |
| 2026-07 | 71 | BUY | — | — | ⏳ |
| 2026-10 | 69 | BUY | — | — | ⏳ |

**BAJFINANCE**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 69 | BUY | +15.8% | +30.3% | ✅ |
| 2024-10 | 69 | BUY | +25.3% | +52.3% | ✅ |
| 2025-01 | 70 | BUY | +12.4% | +18.7% | ✅ |
| 2025-04 | 71 | BUY | +21.5% | +9.2% | ✅ |
| 2025-07 | 75 | BUY | +5.5% | +30.3% | ✅ |
| 2025-10 | 74 | BUY | -10.1% | -5.2% | ❌ |
| 2026-01 | 74 | BUY | +23.5% | — | ✅ |
| 2026-04 | 73 | BUY | +5.5% | — | ✅ |
| 2026-07 | 73 | BUY | — | — | ⏳ |
| 2026-10 | 72 | BUY | — | — | ⏳ |

**HCLTECH**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 65 | BUY | +6.8% | -7.4% | ❌ |
| 2024-10 | 64 | HOLD | -9.3% | -9.4% | Hold |
| 2025-01 | 63 | HOLD | -13.3% | +1.7% | Hold |
| 2025-04 | 64 | HOLD | -0.1% | -20.2% | Hold |
| 2025-07 | 66 | BUY | +17.3% | -4.1% | ❌ |
| 2025-10 | 65 | BUY | -20.1% | -10.8% | ❌ |
| 2026-01 | 65 | BUY | -18.2% | — | ❌ |
| 2026-04 | 69 | BUY | +11.7% | — | ✅ |
| 2026-07 | 70 | BUY | — | — | ⏳ |
| 2026-10 | 71 | BUY | — | — | ⏳ |

**KOTAKBANK**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 67 | BUY | +5.2% | +9.6% | ✅ |
| 2024-10 | 68 | BUY | +27.6% | +21.6% | ✅ |
| 2025-01 | 68 | BUY | +4.2% | +7.4% | ✅ |
| 2025-04 | 69 | BUY | -4.7% | -13.1% | ❌ |
| 2025-07 | 63 | HOLD | +3.1% | -1.2% | Hold |
| 2025-10 | 63 | HOLD | -8.8% | +4.6% | Hold |
| 2026-01 | 63 | HOLD | -4.2% | — | Hold |
| 2026-04 | 80 | BUY | +14.7% | — | ✅ |
| 2026-07 | 65 | BUY | — | — | ⏳ |
| 2026-10 | 68 | BUY | — | — | ⏳ |

**MARUTI**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 82 | BUY | -5.3% | -3.0% | ❌ |
| 2024-10 | 82 | BUY | +10.7% | +47.7% | ✅ |
| 2025-01 | 81 | BUY | +2.4% | +19.9% | ✅ |
| 2025-04 | 81 | BUY | +33.5% | +9.8% | ✅ |
| 2025-07 | 74 | BUY | +17.0% | +14.1% | ✅ |
| 2025-10 | 73 | BUY | -17.7% | -29.8% | ❌ |
| 2026-01 | 73 | BUY | -2.5% | — | ❌ |
| 2026-04 | 72 | BUY | -14.7% | — | ❌ |
| 2026-07 | 74 | BUY | — | — | ⏳ |
| 2026-10 | 76 | BUY | — | — | ⏳ |

**SUNPHARMA**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 71 | BUY | +1.4% | +0.2% | ✅ |
| 2024-10 | 70 | BUY | -0.3% | -7.7% | ❌ |
| 2025-01 | 70 | BUY | -1.2% | -7.7% | ❌ |
| 2025-04 | 69 | BUY | -7.4% | -0.3% | ❌ |
| 2025-07 | 67 | BUY | -6.5% | +17.7% | ✅ |
| 2025-10 | 66 | BUY | +7.7% | +5.0% | ✅ |
| 2026-01 | 67 | BUY | +25.9% | — | ✅ |
| 2026-04 | 66 | BUY | -2.4% | — | ❌ |
| 2026-07 | 67 | BUY | — | — | ⏳ |
| 2026-10 | 66 | BUY | — | — | ⏳ |

**AXISBANK**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 93 | BUY | -15.4% | -8.3% | ❌ |
| 2024-10 | 93 | BUY | +2.2% | +6.4% | ✅ |
| 2025-01 | 93 | BUY | +8.4% | +39.1% | ✅ |
| 2025-04 | 91 | BUY | +4.1% | +7.1% | ✅ |
| 2025-07 | 92 | BUY | +28.3% | +15.2% | ✅ |
| 2025-10 | 91 | BUY | +2.9% | +3.0% | ✅ |
| 2026-01 | 90 | BUY | -10.2% | — | ❌ |
| 2026-04 | 90 | BUY | +0.1% | — | ✅ |
| 2026-07 | 79 | BUY | — | — | ⏳ |
| 2026-10 | 79 | BUY | — | — | ⏳ |

**ULTRACEMCO**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 72 | BUY | -3.4% | +3.7% | ✅ |
| 2024-10 | 73 | BUY | +5.2% | +8.6% | ✅ |
| 2025-01 | 72 | BUY | +7.3% | +11.2% | ✅ |
| 2025-04 | 72 | BUY | +3.3% | +0.2% | ✅ |
| 2025-07 | 49 | SELL | +3.6% | -0.8% | ✅ |
| 2025-10 | 49 | SELL | -3.0% | -8.2% | ✅ |
| 2026-01 | 49 | SELL | -4.3% | — | ✅ |
| 2026-04 | 48 | SELL | -5.3% | — | ✅ |
| 2026-07 | 63 | HOLD | — | — | Hold |
| 2026-10 | 64 | HOLD | — | — | Hold |

**M&M**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 63 | HOLD | +2.8% | +11.0% | Hold |
| 2024-10 | 63 | HOLD | +7.3% | +28.8% | Hold |
| 2025-01 | 62 | HOLD | +8.0% | +15.7% | Hold |
| 2025-04 | 62 | HOLD | +20.0% | +6.6% | Hold |
| 2025-07 | 65 | BUY | +7.1% | +7.2% | ✅ |
| 2025-10 | 64 | HOLD | -11.2% | -17.0% | Hold |
| 2026-01 | 64 | HOLD | +0.1% | — | Hold |
| 2026-04 | 64 | HOLD | -6.6% | — | Hold |
| 2026-07 | 77 | BUY | — | — | ⏳ |
| 2026-10 | 77 | BUY | — | — | ⏳ |

**NTPC**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 61 | HOLD | -20.4% | -17.9% | Hold |
| 2024-10 | 61 | HOLD | -12.5% | -16.0% | Hold |
| 2025-01 | 60 | HOLD | +3.2% | +11.9% | Hold |
| 2025-04 | 60 | HOLD | -4.0% | +15.6% | Hold |
| 2025-07 | 61 | HOLD | +8.5% | +6.6% | Hold |
| 2025-10 | 62 | HOLD | +20.4% | -5.5% | Hold |
| 2026-01 | 63 | HOLD | -1.7% | — | Hold |
| 2026-04 | 62 | HOLD | -21.5% | — | Hold |
| 2026-07 | 59 | HOLD | — | — | Hold |
| 2026-10 | 61 | HOLD | — | — | Hold |

**TITAN**

| Month | Score | Call | Next 6m | Next 12m | Verdict (12m, else 6m) |
|---|---|---|---|---|---|
| 2024-07 | 63 | HOLD | +0.9% | -2.9% | Hold |
| 2024-10 | 62 | HOLD | +3.4% | +15.0% | Hold |
| 2025-01 | 62 | HOLD | -3.8% | +14.3% | Hold |
| 2025-04 | 62 | HOLD | +11.2% | +30.1% | Hold |
| 2025-07 | 55 | HOLD | +18.8% | +46.1% | Hold |
| 2025-10 | 56 | HOLD | +17.0% | +20.2% | Hold |
| 2026-01 | 56 | HOLD | +23.0% | — | Hold |
| 2026-04 | 56 | HOLD | +2.7% | — | Hold |
| 2026-07 | 68 | BUY | — | — | ⏳ |
| 2026-10 | 67 | BUY | — | — | ⏳ |

### Every stock (all months, 6-month horizon)

| Stock | Buy calls | Buy right | Sell calls | Sell right | Latest call |
|---|---|---|---|---|---|
| RELIANCE | 0 | — | 22 | +50% | HOLD (56) |
| TCS | 3 | +0% | 0 | — | BUY (70) |
| HDFCBANK | 20 | +55% | 0 | — | BUY (72) |
| ICICIBANK | 22 | +59% | 0 | — | BUY (79) |
| BHARTIARTL | 10 | +20% | 12 | +8% | BUY (75) |
| INFY | 0 | — | 22 | +77% | SELL (45) |
| SBIN | 22 | +59% | 0 | — | BUY (80) |
| HINDUNILVR | 0 | — | 22 | +73% | HOLD (60) |
| ITC | 10 | +0% | 0 | — | HOLD (61) |
| LT | 22 | +59% | 0 | — | BUY (69) |
| BAJFINANCE | 22 | +86% | 0 | — | BUY (72) |
| HCLTECH | 11 | +27% | 0 | — | BUY (71) |
| KOTAKBANK | 15 | +87% | 0 | — | BUY (68) |
| MARUTI | 22 | +50% | 0 | — | BUY (76) |
| SUNPHARMA | 22 | +50% | 0 | — | BUY (66) |
| AXISBANK | 22 | +77% | 0 | — | BUY (79) |
| ULTRACEMCO | 12 | +67% | 10 | +70% | HOLD (64) |
| M&M | 3 | +100% | 0 | — | BUY (77) |
| NTPC | 0 | — | 0 | — | HOLD (61) |
| TITAN | 0 | — | 0 | — | BUY (67) |
| ONGC | 12 | +42% | 0 | — | HOLD (64) |
| ADANIENT | 0 | — | 22 | +45% | HOLD (50) |
| ADANIPORTS | 22 | +77% | 0 | — | BUY (74) |
| POWERGRID | 0 | — | 10 | +40% | SELL (46) |
| WIPRO | 3 | +0% | 6 | +67% | BUY (67) |
| BAJAJFINSV | 22 | +73% | 0 | — | BUY (70) |
| NESTLEIND | 22 | +77% | 0 | — | BUY (68) |
| ASIANPAINT | 0 | — | 10 | +60% | HOLD (55) |
| JSWSTEEL | 0 | — | 10 | +20% | BUY (73) |
| COALINDIA | 22 | +55% | 0 | — | BUY (77) |
| TATASTEEL | 0 | — | 22 | +32% | HOLD (57) |
| BAJAJ-AUTO | 22 | +68% | 0 | — | BUY (79) |
| HINDALCO | 10 | +90% | 0 | — | HOLD (64) |
| GRASIM | 0 | — | 22 | +32% | SELL (46) |
| TECHM | 0 | — | 13 | +77% | HOLD (61) |
| SBILIFE | 0 | — | 0 | — | SELL (48) |
| HDFCLIFE | 0 | — | 10 | +100% | SELL (44) |
| EICHERMOT | 22 | +86% | 0 | — | BUY (79) |
| BRITANNIA | 0 | — | 22 | +55% | HOLD (54) |
| DRREDDY | 22 | +50% | 0 | — | HOLD (58) |
| CIPLA | 22 | +41% | 0 | — | HOLD (60) |
| APOLLOHOSP | 10 | +80% | 0 | — | BUY (72) |
| HEROMOTOCO | 22 | +50% | 0 | — | BUY (90) |
| TATACONSUM | 0 | — | 13 | +31% | HOLD (56) |
| SHRIRAMFIN | 22 | +73% | 0 | — | BUY (84) |
| BEL | 22 | +64% | 0 | — | BUY (71) |
| TRENT | 22 | +23% | 0 | — | BUY (71) |
| INDUSINDBK | 12 | +17% | 10 | +10% | SELL (31) |
| DIVISLAB | 0 | — | 12 | +25% | HOLD (62) |
| PIDILITIND | 0 | — | 0 | — | BUY (66) |
| DABUR | 0 | — | 10 | +90% | HOLD (56) |
| GODREJCP | 0 | — | 22 | +77% | SELL (48) |
| HAVELLS | 0 | — | 0 | — | HOLD (64) |
| SIEMENS | 6 | +0% | 0 | — | HOLD (54) |
| DLF | 1 | +100% | 12 | +58% | HOLD (53) |
| VEDL | 0 | — | 0 | — | BUY (75) |
| IOC | 12 | +67% | 0 | — | BUY (73) |
| BPCL | 22 | +55% | 0 | — | BUY (74) |
| GAIL | 10 | +60% | 0 | — | HOLD (60) |
| TVSMOTOR | 10 | +60% | 0 | — | BUY (68) |
| CHOLAFIN | 22 | +73% | 0 | — | BUY (77) |
| ICICIGI | 22 | +36% | 0 | — | BUY (69) |
| AMBUJACEM | 0 | — | 0 | — | HOLD (51) |
| SHREECEM | 12 | +67% | 10 | +100% | HOLD (54) |
| BERGEPAINT | 0 | — | 0 | — | HOLD (57) |
| MARICO | 0 | — | 0 | — | BUY (67) |
| COLPAL | 0 | — | 0 | — | HOLD (60) |
| TORNTPHARM | 22 | +86% | 0 | — | HOLD (60) |
| LUPIN | 22 | +50% | 0 | — | BUY (88) |
| ZYDUSLIFE | 22 | +55% | 0 | — | BUY (79) |
| BANKBARODA | 22 | +45% | 0 | — | BUY (76) |
| PNB | 22 | +59% | 0 | — | BUY (72) |
| CANBK | 22 | +45% | 0 | — | BUY (74) |
| HAL | 2 | +100% | 0 | — | HOLD (62) |
| IRCTC | 15 | +7% | 0 | — | BUY (73) |
| BOSCHLTD | 13 | +54% | 0 | — | BUY (72) |
| MOTHERSON | 22 | +68% | 0 | — | BUY (74) |
| PAGEIND | 0 | — | 12 | +42% | HOLD (56) |
| MUTHOOTFIN | 22 | +73% | 0 | — | BUY (91) |
| SRF | 0 | — | 22 | +50% | HOLD (50) |
| UPL | 0 | — | 22 | +41% | HOLD (55) |
| INDIGO | 22 | +64% | 0 | — | HOLD (54) |
| NAUKRI | 0 | — | 22 | +82% | HOLD (51) |
| PERSISTENT | 22 | +55% | 0 | — | BUY (76) |
| MPHASIS | 0 | — | 0 | — | HOLD (62) |
| COFORGE | 12 | +67% | 0 | — | BUY (78) |
| POLYCAB | 22 | +68% | 0 | — | BUY (77) |
| DIXON | 22 | +45% | 0 | — | BUY (76) |
| ASTRAL | 0 | — | 8 | +38% | HOLD (57) |
| ABB | 21 | +48% | 0 | — | BUY (66) |
| CUMMINSIND | 22 | +73% | 0 | — | BUY (72) |
| TATAPOWER | 0 | — | 10 | +50% | SELL (41) |
| JINDALSTEL | 0 | — | 10 | +30% | SELL (39) |
| PIIND | 22 | +18% | 0 | — | SELL (43) |
| BALKRISIND | 10 | +30% | 0 | — | HOLD (52) |
| VOLTAS | 10 | +40% | 0 | — | HOLD (51) |
| HDFCAMC | 22 | +64% | 0 | — | BUY (72) |
| UNITDSPR | 0 | — | 0 | — | HOLD (58) |
| GLAND | 0 | — | 0 | — | BUY (65) |
| HAPPSTMNDS | 0 | — | 0 | — | BUY (71) |

## Part 2 — 19 years, price-trend signal only (2007-09 → today)

Fundamental history isn't available for 20 years, so this tests only the model's **trend component**: Buy when the price is above its 10-month average and up over the past year (excluding the last month), Sell when it falls below the 10-month average. This is *not* the full model.

101 stocks (each enters once it has a year of prices) · 21174 stock-month calls · call mix: BUY 11447 · HOLD 2217 · SELL 7510

### Accuracy

| Horizon | Calls graded | Buy calls · went up · beat NIFTY · avg return | Sell calls · went down · lagged NIFTY · avg return | Hold calls · went up · avg | Buy+Sell accuracy | NIFTY avg |
|---|---|---|---|---|---|---|
| 3 months | 20874 | 11360 · +61% · +56% · +5.3% | 7327 · +41% · +47% · +5.1% | 2187 · +61% · +7.0% | **+53%** | +2.5% |
| 6 months | 20574 | 11255 · +65% · +58% · +10.8% | 7172 · +38% · +46% · +11.9% | 2147 · +66% · +14.2% | **+55%** | +5.2% |
| 12 months | 19974 | 10990 · +69% · +61% · +21.7% | 6891 · +31% · +42% · +31.7% | 2093 · +74% · +30.0% | **+54%** | +11.4% |

### Accuracy by year (12-month horizon)

| Year | Buy right | Sell right | Buy+Sell accuracy | NIFTY next 12m (avg) |
|---|---|---|---|---|
| 2007 | +6% | +86% | +23% | -44.3% |
| 2008 | +25% | +34% | +32% | +9.3% |
| 2009 | +89% | +1% | +62% | +35.3% |
| 2010 | +65% | +53% | +63% | -1.8% |
| 2011 | +73% | +41% | +55% | +2.7% |
| 2012 | +75% | +44% | +64% | +9.4% |
| 2013 | +87% | +8% | +51% | +26.2% |
| 2014 | +73% | +19% | +66% | +13.1% |
| 2015 | +56% | +38% | +48% | -1.6% |
| 2016 | +87% | +19% | +56% | +18.8% |
| 2017 | +68% | +29% | +59% | +12.4% |
| 2018 | +61% | +47% | +54% | +6.8% |
| 2019 | +59% | +53% | +56% | -3.2% |
| 2020 | +92% | +3% | +44% | +44.5% |
| 2021 | +65% | +35% | +62% | +9.3% |
| 2022 | +73% | +26% | +49% | +9.6% |
| 2023 | +91% | +10% | +69% | +24.6% |
| 2024 | +51% | +32% | +46% | +4.6% |
| 2025 | +49% | +42% | +45% | -1.9% |

### ₹1,00,000 following the trend signal since 2007-09

| Strategy | ₹1,00,000 became | Total return | CAGR | Worst drawdown |
|---|---|---|---|---|
| **Follow the model** | **₹21,18,858** | +2018.9% | +17.4% | -55.3% |
| NIFTY 50 index (price, no dividends) | ₹4,52,507 | +352.5% | +8.2% | -55.1% |
| Hold every stock equally | ₹36,01,970 | +3502.0% | +20.7% | -54.5% |

| Year end | Trend portfolio | NIFTY 50 | Stocks held |
|---|---|---|---|
| 2007-12 | ₹1,30,717 | ₹1,22,250 | 57 |
| 2008-12 | ₹59,883 | ₹58,931 | 2 |
| 2009-12 | ₹1,10,714 | ₹1,03,579 | 83 |
| 2010-12 | ₹1,52,063 | ₹1,22,168 | 68 |
| 2011-12 | ₹1,35,007 | ₹92,093 | 23 |
| 2012-12 | ₹1,94,653 | ₹1,17,600 | 63 |
| 2013-12 | ₹2,23,326 | ₹1,25,544 | 45 |
| 2014-12 | ₹3,61,681 | ₹1,64,950 | 83 |
| 2015-12 | ₹3,96,764 | ₹1,58,251 | 29 |
| 2016-12 | ₹4,08,893 | ₹1,63,020 | 49 |
| 2017-12 | ₹6,15,628 | ₹2,09,719 | 69 |
| 2018-12 | ₹6,12,180 | ₹2,16,327 | 35 |
| 2019-12 | ₹7,34,208 | ₹2,42,334 | 49 |
| 2020-12 | ₹9,24,719 | ₹2,78,446 | 56 |
| 2021-12 | ₹13,35,437 | ₹3,45,605 | 73 |
| 2022-12 | ₹14,53,295 | ₹3,60,566 | 55 |
| 2023-12 | ₹19,85,846 | ₹4,32,780 | 78 |
| 2024-12 | ₹24,68,328 | ₹4,70,885 | 51 |
| 2025-12 | ₹24,42,183 | ₹5,20,370 | 60 |
| 2026-10 | ₹21,18,858 | ₹4,52,507 | 27 |

## Caveats — read before trusting the numbers

- **Short full-model window:** Jul 2024 onwards is roughly one market phase (a correction after the 2023–24 rally). Accuracy will vary across cycles; re-run quarterly as data accumulates.
- **Survivorship bias:** the universe is today's NIFTY 100. Companies that collapsed and left the index are missing, which flatters every strategy, especially the 20-year test and the equal-weight benchmark. Compare the model against "hold every stock equally" (same bias) rather than against NIFTY alone.
- **NIFTY benchmark excludes dividends** (~1.2–1.5%/yr), while stock returns include them.
- **Thresholds and weights** were chosen on part of this same period, so Part 1 is partly in-sample.
- **Taxes are ignored:** short-term capital gains tax on monthly trading would reduce the model portfolio's real return.
- Educational research, not investment advice.
