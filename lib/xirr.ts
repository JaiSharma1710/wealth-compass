export type CashFlow = {
  /** Negative = money invested, positive = money received / current value. */
  amount: number;
  date: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function npv(rate: number, flows: CashFlow[], start: number) {
  return flows.reduce(
    (sum, flow) => sum + flow.amount / Math.pow(1 + rate, (flow.date.getTime() - start) / (365 * DAY_MS)),
    0
  );
}

/**
 * Annualised internal rate of return for irregular cash flows, as a percentage.
 * Returns null when it is undefined (no outflow/inflow pair) or the history is shorter
 * than `minDays` — annualising a few months wildly exaggerates returns, so (as with
 * SEBI/AMFI reporting) periods under a year should show absolute returns instead.
 */
export function calculateXirr(flows: CashFlow[], options: { minDays?: number } = {}): number | null {
  const minDays = options.minDays ?? 365;
  const valid = flows
    .filter((flow) => Number.isFinite(flow.amount) && flow.amount !== 0 && !Number.isNaN(flow.date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (!valid.some((flow) => flow.amount < 0) || !valid.some((flow) => flow.amount > 0)) {
    return null;
  }

  const start = valid[0].date.getTime();
  const end = valid[valid.length - 1].date.getTime();

  if (end - start < minDays * DAY_MS - DAY_MS / 2) {
    return null;
  }

  // Bisection is slower than Newton but cannot diverge on unusual flow patterns.
  let low = -0.9999;
  let high = 100;
  let lowValue = npv(low, valid, start);
  const highValue = npv(high, valid, start);

  if (lowValue * highValue > 0) {
    return null;
  }

  for (let iteration = 0; iteration < 200; iteration += 1) {
    const mid = (low + high) / 2;
    const midValue = npv(mid, valid, start);

    if (Math.abs(midValue) < 1e-7 || high - low < 1e-9) {
      return Math.round(mid * 10000) / 100;
    }

    if (lowValue * midValue < 0) {
      high = mid;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }

  return Math.round(((low + high) / 2) * 10000) / 100;
}
