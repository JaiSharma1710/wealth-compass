# Stock model backtest — 2026-10-14

Universe: 100 NSE stocks · 6 quarterly formation dates (2024-07 → 2025-09) · 600 stock-date observations · horizon 12 months, return vs universe median.

## Each pillar on its own
| Pillar | Rank IC | IC t-stat | Top−bottom quintile | Top-quintile hit rate |
|---|---|---|---|---|
| quality | -0.005 | -0.13 | 1.4% | 50.8% |
| growth | 0.196 | 9.28 | 8.2% | 65.0% |
| strength | -0.079 | -1.45 | -0.5% | 44.2% |
| earningsQuality | -0.027 | -0.95 | -1.5% | 45.8% |
| valuation | 0.120 | 1.83 | 6.6% | 62.5% |
| momentum | -0.021 | -0.48 | -2.6% | 46.7% |

Long-run momentum check (12-1 month return, price-only, 2017 onwards, 36 dates): IC 0.026 (t 0.90), top−bottom 3.3%, hit rate 50.8%.

## Composite
| Weights | Rank IC | IC t-stat | Top−bottom | Hit rate | Quintile excess returns (Q1 best → Q5) |
|---|---|---|---|---|---|
| Literature prior | 0.178 | 4.41 | 10.7% | 68.3% | 11.2% / 1.5% / -1.2% / -2.9% / 0.5% |
| Calibrated (in-sample) | 0.230 | 5.48 | 14.3% | 67.5% | 11.3% / 4.6% / -1.8% / -2.0% / -3.0% |

## Out-of-sample (leave one year out)
| Held-out year | Prior IC | Tuned IC | Prior spread | Tuned spread |
|---|---|---|---|---|
| 2024 | 0.058 | 0.112 | 3.0% | 4.0% |
| 2025 | 0.237 | 0.258 | 14.5% | 14.2% |

## Calibrated weights (50% optimised, 50% prior)
```json
{
  "quality": 0.225,
  "growth": 0.3,
  "strength": 0.075,
  "earningsQuality": 0.05,
  "valuation": 0.3,
  "momentum": 0.05
}
```
