import { Decimal } from "decimal.js";

export type ProfitInput = {
  revenue: number | string | Decimal;
  cost: number | string | Decimal;
  additionalCost?: number | string | Decimal;
};

export type ProfitResult = {
  revenue: Decimal;
  cost: Decimal;
  additionalCost: Decimal;
  grossProfit: Decimal;
  marginPercent: Decimal;
};

function d(value: number | string | Decimal | null | undefined): Decimal {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined || value === "") return new Decimal(0);
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

/**
 * Gross profit = revenue − cost − additionalCost
 * Margin % = (grossProfit / revenue) × 100  (0 when revenue is 0)
 */
export function calculateProfitability(input: ProfitInput): ProfitResult {
  const revenue = d(input.revenue);
  const cost = d(input.cost);
  const additionalCost = d(input.additionalCost);
  const grossProfit = revenue.minus(cost).minus(additionalCost);
  const marginPercent = revenue.isZero()
    ? new Decimal(0)
    : grossProfit.div(revenue).mul(100);

  return {
    revenue,
    cost,
    additionalCost,
    grossProfit,
    marginPercent,
  };
}

export function sumDecimals(values: Array<number | string | Decimal | null | undefined>): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(d(v)), new Decimal(0));
}
