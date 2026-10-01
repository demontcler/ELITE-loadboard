export type PaperworkItem = {
  documentType: string;
  label: string;
  required: boolean;
  present: boolean;
  blocksPayment: boolean;
};

export type PaperworkResult = {
  items: PaperworkItem[];
  complete: boolean;
  missingRequired: string[];
  paymentHold: boolean;
  holdReasons: string[];
};

/**
 * Evaluate configurable paperwork checklist for a truck assignment.
 * Missing required docs that block payment → ON HOLD.
 */
export function evaluatePaperwork(items: PaperworkItem[]): PaperworkResult {
  const missingRequired = items
    .filter((i) => i.required && !i.present)
    .map((i) => i.label || i.documentType);

  const holdReasons = items
    .filter((i) => i.required && i.blocksPayment && !i.present)
    .map((i) => `Missing ${i.label || i.documentType}`);

  return {
    items,
    complete: missingRequired.length === 0,
    missingRequired,
    paymentHold: holdReasons.length > 0,
    holdReasons,
  };
}

export const DEFAULT_TRUCK_PAPERWORK: Omit<PaperworkItem, "present">[] = [
  { documentType: "RATE_CONFIRMATION", label: "Rate Confirmation", required: true, blocksPayment: false },
  { documentType: "BOL", label: "BOL", required: true, blocksPayment: false },
  { documentType: "POD", label: "POD", required: true, blocksPayment: true },
  { documentType: "CARRIER_INVOICE", label: "Carrier Invoice", required: true, blocksPayment: true },
];
