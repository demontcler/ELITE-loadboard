/** Extensible document type catalogs by entity. */

export const OPERATIONAL_DOC_TYPES = [
  { value: "BOL", label: "BOL" },
  { value: "POD", label: "POD" },
  { value: "RATE_CONFIRMATION", label: "Rate Confirmation" },
  { value: "LOAD_SHEET", label: "Load Sheet" },
  { value: "PIPE_TALLY", label: "Pipe Tally" },
  { value: "SCALE_TICKET", label: "Scale Ticket" },
  { value: "CUSTOMER_PO", label: "Customer PO" },
  { value: "DELIVERY_TICKET", label: "Delivery Ticket" },
  { value: "FIELD_TICKET", label: "Field Ticket" },
  { value: "PHOTO", label: "Photo" },
  { value: "CARRIER_INVOICE", label: "Carrier Invoice" },
  { value: "OTHER_OPERATIONAL", label: "Other Operational" },
] as const;

export const CUSTOMER_DOC_TYPES = [
  { value: "MASTER_SERVICE_AGREEMENT", label: "Master Service Agreement" },
  { value: "RATE_AGREEMENT", label: "Rate Agreement" },
  { value: "CREDIT_APPLICATION", label: "Credit Application" },
  { value: "CUSTOMER_CONTRACT", label: "Customer Contract" },
  { value: "INSURANCE_REQUIREMENT", label: "Insurance Requirement" },
  { value: "CUSTOMER_TAX_DOCUMENT", label: "Tax Document" },
  { value: "CUSTOMER_SAFETY_REQUIREMENT", label: "Safety Requirement" },
  { value: "OTHER_CUSTOMER", label: "Other" },
] as const;

export const CARRIER_DOC_TYPES = [
  { value: "CERTIFICATE_OF_INSURANCE", label: "Certificate of Insurance" },
  { value: "COI", label: "COI" },
  { value: "AUTO_LIABILITY", label: "Auto Liability" },
  { value: "CARGO_INSURANCE", label: "Cargo Insurance" },
  { value: "GENERAL_LIABILITY", label: "General Liability" },
  { value: "WORKERS_COMP", label: "Workers Comp" },
  { value: "W9", label: "W-9" },
  { value: "OPERATING_AUTHORITY", label: "Operating Authority" },
  { value: "CARRIER_AGREEMENT", label: "Carrier Agreement" },
  { value: "SAFETY_DOCUMENT", label: "Safety Document" },
  { value: "OTHER_CARRIER", label: "Other" },
] as const;

export const DRIVER_DOC_TYPES = [
  { value: "CDL", label: "CDL" },
  { value: "MEDICAL_CARD", label: "Medical Card" },
  { value: "TWIC", label: "TWIC" },
  { value: "DRIVER_CERTIFICATION", label: "Driver Certification" },
  { value: "TRAINING_CERTIFICATE", label: "Training Certificate" },
  { value: "OTHER_DRIVER", label: "Other" },
] as const;

export const EQUIPMENT_DOC_TYPES = [
  { value: "REGISTRATION", label: "Registration" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "PERMIT", label: "Permit" },
  { value: "MAINTENANCE_DOCUMENT", label: "Maintenance Document" },
  { value: "OTHER_EQUIPMENT", label: "Other" },
] as const;

export const JOB_DOC_TYPES = [
  { value: "RATE_CONFIRMATION", label: "Rate Confirmation" },
  { value: "CUSTOMER_PO", label: "Customer PO" },
  { value: "LOAD_SHEET", label: "Load Sheet" },
  { value: "PHOTO", label: "Photo" },
  { value: "OTHER_OPERATIONAL", label: "Other" },
] as const;

export type DocumentOwnerType =
  | "JOB"
  | "TRUCK_ASSIGNMENT"
  | "CUSTOMER"
  | "CARRIER"
  | "DRIVER"
  | "TRACTOR"
  | "TRAILER";

export const ALLOWED_UPLOAD_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
