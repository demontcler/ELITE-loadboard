import { Decimal, calculatePipeWeight, type PipeCalcInput } from "./pipe";

export type CargoWeightInput = PipeCalcInput & {
  id?: string;
  materialDescription?: string;
};

export type CargoWeightResult = {
  id?: string;
  materialDescription?: string;
  totalFootage: Decimal;
  calculatedWeightLbs: Decimal;
  effectiveWeightLbs: Decimal;
  usedOverride: boolean;
};

export type TruckWeightSummary = {
  items: CargoWeightResult[];
  totalFootage: Decimal;
  totalWeightLbs: Decimal;
  exceedsThreshold: boolean;
  thresholdLbs: Decimal;
};

/**
 * Sum cargo item weights for a truck assignment and compare to configurable threshold.
 */
export function summarizeTruckWeight(
  items: CargoWeightInput[],
  thresholdLbs: number | string | Decimal = 48000
): TruckWeightSummary {
  const threshold =
    thresholdLbs instanceof Decimal ? thresholdLbs : new Decimal(thresholdLbs);

  const results: CargoWeightResult[] = items.map((item) => {
    const calc = calculatePipeWeight(item);
    return {
      id: item.id,
      materialDescription: item.materialDescription,
      totalFootage: calc.totalFootage,
      calculatedWeightLbs: calc.calculatedWeightLbs,
      effectiveWeightLbs: calc.effectiveWeightLbs,
      usedOverride: calc.usedOverride,
    };
  });

  const totalFootage = results.reduce(
    (sum, r) => sum.plus(r.totalFootage),
    new Decimal(0)
  );
  const totalWeightLbs = results.reduce(
    (sum, r) => sum.plus(r.effectiveWeightLbs),
    new Decimal(0)
  );

  return {
    items: results,
    totalFootage,
    totalWeightLbs,
    exceedsThreshold: totalWeightLbs.gt(threshold),
    thresholdLbs: threshold,
  };
}
