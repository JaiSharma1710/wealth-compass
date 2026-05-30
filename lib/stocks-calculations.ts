type BuyLot = {
  quantity: number;
  price: number;
};

type SellLot = {
  quantity: number;
  price: number;
  brokerage?: number;
  taxes?: number;
  charges?: number;
};

type TodayPnLInput = {
  quantity: number;
  regularMarketChange?: number | null;
  currentPrice?: number | null;
  regularMarketPreviousClose?: number | null;
};

export function roundPrice(value: number) {
  return Math.round(value * 10000) / 10000;
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

export function sumCharges(input: {
  brokerage?: number;
  taxes?: number;
  charges?: number;
}) {
  return roundCurrency((input.brokerage || 0) + (input.taxes || 0) + (input.charges || 0));
}

export function calculateAverageStockPrice(purchases: BuyLot[]) {
  if (!purchases.length) {
    return 0;
  }

  let totalQuantity = 0;
  let totalAmount = 0;

  for (const purchase of purchases) {
    if (!Number.isInteger(purchase.quantity) || purchase.quantity <= 0) {
      throw new Error("BUY quantity must be a positive integer.");
    }

    if (!Number.isFinite(purchase.price) || purchase.price <= 0) {
      throw new Error("Buy price must be greater than 0.");
    }

    totalQuantity += purchase.quantity;
    totalAmount += purchase.quantity * purchase.price;
  }

  return totalQuantity > 0 ? roundPrice(totalAmount / totalQuantity) : 0;
}

export function calculateHoldingQuantity(buys: Array<{ quantity: number }>, sells: Array<{ quantity: number }>) {
  return buys.reduce((sum, entry) => sum + entry.quantity, 0) -
    sells.reduce((sum, entry) => sum + entry.quantity, 0);
}

export function calculateBuyCashFlow(input: BuyLot & { brokerage?: number; taxes?: number; charges?: number }) {
  const buyGrossAmount = roundCurrency(input.quantity * input.price);
  const buyCharges = sumCharges(input);
  const buyNetAmount = roundCurrency(buyGrossAmount + buyCharges);

  return {
    buyGrossAmount,
    buyCharges,
    buyNetAmount,
  };
}

export function calculateSellSnapshot(input: SellLot & { averagePriceAtSellTime: number }) {
  const sellGrossAmount = roundCurrency(input.quantity * input.price);
  const sellCharges = sumCharges(input);
  const costBasis = roundCurrency(input.averagePriceAtSellTime * input.quantity);
  const sellNetAmount = roundCurrency(sellGrossAmount - sellCharges);
  const realizedProfitForSell = roundCurrency(sellGrossAmount - costBasis - sellCharges);

  return {
    averagePriceAtSellTime: roundPrice(input.averagePriceAtSellTime),
    costBasis,
    sellGrossAmount,
    sellCharges,
    sellNetAmount,
    realizedProfitForSell,
  };
}

export function calculateHoldingMetrics(input: {
  quantity: number;
  averagePrice: number;
  currentPrice: number | null;
}) {
  const investedAmount = roundCurrency(input.quantity * input.averagePrice);
  const currentValue = input.currentPrice == null
    ? 0
    : roundCurrency(input.quantity * input.currentPrice);
  const unrealizedProfit = roundCurrency(currentValue - investedAmount);
  const unrealizedProfitPercent = investedAmount > 0
    ? roundPercent((unrealizedProfit / investedAmount) * 100)
    : 0;

  return {
    investedAmount,
    currentValue,
    unrealizedProfit,
    unrealizedProfitPercent,
  };
}

export function calculateTodayPnL(input: TodayPnLInput) {
  if (input.regularMarketChange != null && Number.isFinite(input.regularMarketChange)) {
    return roundCurrency(input.quantity * input.regularMarketChange);
  }

  if (
    input.currentPrice != null &&
    Number.isFinite(input.currentPrice) &&
    input.regularMarketPreviousClose != null &&
    Number.isFinite(input.regularMarketPreviousClose)
  ) {
    return roundCurrency(input.quantity * (input.currentPrice - input.regularMarketPreviousClose));
  }

  return null;
}

export function calculateTodayPnLPercent(todayPnL: number | null, currentValue: number) {
  if (todayPnL == null || currentValue <= 0) {
    return null;
  }

  const previousValue = currentValue - todayPnL;

  if (previousValue <= 0) {
    return null;
  }

  return roundPercent((todayPnL / previousValue) * 100);
}

export function calculateNextBuyLifecycleState(input: {
  currentQuantity: number;
  currentAveragePrice: number;
  buyQuantity: number;
  buyPrice: number;
}) {
  const nextQuantity = input.currentQuantity + input.buyQuantity;
  const averagePrice = calculateAverageStockPrice([
    { quantity: input.currentQuantity, price: input.currentAveragePrice },
    { quantity: input.buyQuantity, price: input.buyPrice },
  ].filter((entry) => entry.quantity > 0));

  return {
    quantity: nextQuantity,
    averagePrice,
    investedAmount: roundCurrency(nextQuantity * averagePrice),
  };
}

export function calculateNextSellLifecycleState(input: {
  currentQuantity: number;
  currentAveragePrice: number;
  sellQuantity: number;
}) {
  const remainingQuantity = input.currentQuantity - input.sellQuantity;
  const investedAmount = remainingQuantity > 0
    ? roundCurrency(remainingQuantity * input.currentAveragePrice)
    : 0;

  return {
    remainingQuantity,
    averagePrice: remainingQuantity > 0 ? roundPrice(input.currentAveragePrice) : 0,
    investedAmount,
  };
}
