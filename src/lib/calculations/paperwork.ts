import { evaluateDocumentStatus, type DocComplianceStatus } from "./compliance";

export type PaperworkItem = {
  documentType: string;
  label: string;
  required: boolean;
  present: boolean;
  blocksPayment: boolean;
  blocksInvoice?: boolean;
};

export type PaperworkResult = {
  items: PaperworkItem[];
  complete: boolean;
  missingRequired: string[];
  paymentHold: boolean;
  invoiceHold: boolean;
  holdReasons: string[];
  invoiceHoldReasons: string[];
};

/**
 * Evaluate configurable paperwork checklist for a truck assignment.
 */
export function evaluatePaperwork(items: PaperworkItem[]): PaperworkResult {
  const missingRequired = items
    .filter((i) => i.required && !i.present)
    .map((i) => i.label || i.documentType);

  const holdReasons = items
    .filter((i) => i.required && i.blocksPayment && !i.present)
    .map((i) => `Missing ${i.label || i.documentType}`);

  const invoiceHoldReasons = items
    .filter((i) => i.required && (i.blocksInvoice ?? i.documentType === "POD") && !i.present)
    .map((i) => `Missing ${i.label || i.documentType}`);

  return {
    items,
    complete: missingRequired.length === 0,
    missingRequired,
    paymentHold: holdReasons.length > 0,
    invoiceHold: invoiceHoldReasons.length > 0,
    holdReasons,
    invoiceHoldReasons,
  };
}

export const DEFAULT_TRUCK_PAPERWORK: Omit<PaperworkItem, "present">[] = [
  { documentType: "BOL", label: "BOL", required: true, blocksPayment: false, blocksInvoice: false },
  { documentType: "POD", label: "POD", required: true, blocksPayment: true, blocksInvoice: true },
];

export type TruckPaperworkSummary = {
  truckAssignmentId: string;
  displayId: string;
  bol: boolean;
  pod: boolean;
  complete: boolean;
  missing: string[];
  statusLabel: string;
};

export function summarizeTruckPaperworkRow(params: {
  truckAssignmentId: string;
  displayId: string;
  documentTypes: string[];
  requirements?: Array<{ documentType: string; label: string; isRequired: boolean }>;
}): TruckPaperworkSummary {
  const reqs =
    params.requirements?.filter((r) => r.isRequired) ??
    DEFAULT_TRUCK_PAPERWORK.filter((r) => r.required).map((r) => ({
      documentType: r.documentType,
      label: r.label,
      isRequired: true,
    }));
  const present = new Set(params.documentTypes.map((t) => t.toUpperCase()));
  const bol = present.has("BOL");
  const pod = present.has("POD");
  const missing = reqs
    .filter((r) => !present.has(r.documentType.toUpperCase()))
    .map((r) => r.label || r.documentType);
  const complete = missing.length === 0;
  let statusLabel = "COMPLETE";
  if (!complete) {
    if (missing.length === 1 && missing[0] === "POD") statusLabel = "MISSING POD";
    else if (!bol && !pod) statusLabel = "INCOMPLETE";
    else statusLabel = `MISSING ${missing.join(", ")}`;
  }
  return {
    truckAssignmentId: params.truckAssignmentId,
    displayId: params.displayId,
    bol,
    pod,
    complete,
    missing,
    statusLabel,
  };
}

export type JobPaperworkSummary = {
  trucksTotal: number;
  bolsReceived: number;
  podsReceived: number;
  paperworkComplete: number;
  trucksMissingPod: number;
  incompleteTrucks: Array<{ displayId: string; missing: string[] }>;
  complete: boolean;
};

export function getJobPaperworkSummary(
  trucks: TruckPaperworkSummary[]
): JobPaperworkSummary {
  const bolsReceived = trucks.filter((t) => t.bol).length;
  const podsReceived = trucks.filter((t) => t.pod).length;
  const paperworkComplete = trucks.filter((t) => t.complete).length;
  const incompleteTrucks = trucks
    .filter((t) => !t.complete)
    .map((t) => ({ displayId: t.displayId, missing: t.missing }));
  return {
    trucksTotal: trucks.length,
    bolsReceived,
    podsReceived,
    paperworkComplete,
    trucksMissingPod: trucks.filter((t) => !t.pod).length,
    incompleteTrucks,
    complete: trucks.length > 0 && incompleteTrucks.length === 0,
  };
}

export function isTruckPaperworkComplete(summary: TruckPaperworkSummary): boolean {
  return summary.complete;
}

export function getMissingRequiredDocuments(summary: TruckPaperworkSummary): string[] {
  return summary.missing;
}

export type ComplianceAlert = {
  entityType: string;
  entityId: string;
  entityLabel: string;
  documentType: string;
  status: DocComplianceStatus | "NOT_REQUIRED";
  expirationDate?: Date | null;
  message: string;
};

export function buildComplianceStatus(params: {
  required: boolean;
  present: boolean;
  expirationDate?: Date | null;
  expiresSoonDays?: number;
}): DocComplianceStatus | "NOT_REQUIRED" {
  if (!params.required && !params.present) return "NOT_REQUIRED";
  if (params.required && !params.present) return "MISSING";
  if (!params.present) return "MISSING";
  return evaluateDocumentStatus(params.expirationDate, params.expiresSoonDays ?? 30);
}
