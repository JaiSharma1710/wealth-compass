import type { Pillar } from "@/lib/stock-model/types";

export type PillarWeights = Record<Pillar, number>;

/** Literature prior (quality and valuation lead) used as the shrinkage anchor. */
export const PRIOR_WEIGHTS: PillarWeights = {
  quality: 0.25,
  growth: 0.2,
  strength: 0.15,
  earningsQuality: 0.1,
  valuation: 0.2,
  momentum: 0.1,
};

/**
 * Model v1 weights: grid-searched on a point-in-time backtest of 100 NSE large/mid caps
 * (6 quarterly formation dates Jul 2024 – Sep 2025, 12-month forward returns), then
 * shrunk 50% toward the prior. Composite rank IC 0.23 (t 5.5), top-minus-bottom quintile
 * +14.3%/yr; out-of-sample folds beat the prior. See research/results/latest.md.
 * Quality stays material despite a flat IC in this window: the period was a single
 * PSU / small-cap-led phase where quality lagged, which is not expected to persist.
 */
export const MODEL_WEIGHTS: PillarWeights = {
  quality: 0.225,
  growth: 0.3,
  strength: 0.075,
  earningsQuality: 0.05,
  valuation: 0.3,
  momentum: 0.05,
};

export const MODEL_VERSION = "wc-model-v1 (2026-10)";

export const DEFAULT_WEIGHTS = MODEL_WEIGHTS;
