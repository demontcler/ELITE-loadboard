import { Decimal } from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type PipeCalcInput = {
  numberOfJoints?: number | string | null;
  jointLengthFt?: number | string | null;
  totalFootage?: number | string | null;
  weightPerFoot?: number | string | null;
  manualWeightOverrideLbs?: number | string | null;
};

export type PipeCalcResult = {
  totalFootage: Decimal;
  calculatedWeightLbs: Decimal;
  effectiveWeightLbs: Decimal;
  usedOverride: boolean;
  derivedFootageFromJoints: boolean;
};

function toDecimal(value: number | string | null | undefined): Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const d = new Decimal(value);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

/**
 * Primary pipe weight calculation.
 * - If joints + joint length supplied → footage = joints × jointLength
 * - Else use provided totalFootage
 * - Weight = footage × weightPerFoot
 * - Manual override replaces calculated weight when present
 */
export function calculatePipeWeight(input: PipeCalcInput): PipeCalcResult {
  const joints = toDecimal(input.numberOfJoints);
  const jointLength = toDecimal(input.jointLengthFt);
  const providedFootage = toDecimal(input.totalFootage);
  const wtPerFt = toDecimal(input.weightPerFoot);
  const override = toDecimal(input.manualWeightOverrideLbs);

  let totalFootage = new Decimal(0);
  let derivedFootageFromJoints = false;

  if (joints && jointLength && joints.gt(0) && jointLength.gt(0)) {
    totalFootage = joints.mul(jointLength);
    derivedFootageFromJoints = true;
  } else if (providedFootage && providedFootage.gte(0)) {
    totalFootage = providedFootage;
  }

  const calculatedWeightLbs =
    wtPerFt && totalFootage.gte(0) ? totalFootage.mul(wtPerFt) : new Decimal(0);

  const usedOverride = override !== null;
  const effectiveWeightLbs = usedOverride ? override! : calculatedWeightLbs;

  return {
    totalFootage,
    calculatedWeightLbs,
    effectiveWeightLbs,
    usedOverride,
    derivedFootageFromJoints,
  };
}
