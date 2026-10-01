import { z } from "zod";

export const customerSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  dba: z.string().max(200).optional().nullable(),
  billingAddress1: z.string().max(200).optional().nullable(),
  billingAddress2: z.string().max(200).optional().nullable(),
  billingCity: z.string().max(100).optional().nullable(),
  billingState: z.string().max(50).optional().nullable(),
  billingZip: z.string().max(20).optional().nullable(),
  physicalAddress1: z.string().max(200).optional().nullable(),
  physicalAddress2: z.string().max(200).optional().nullable(),
  physicalCity: z.string().max(100).optional().nullable(),
  physicalState: z.string().max(50).optional().nullable(),
  physicalZip: z.string().max(20).optional().nullable(),
  mainPhone: z.string().max(40).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "RESTRICTED", "ARCHIVED"]).default("ACTIVE"),
  paymentTerms: z
    .enum(["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_45", "NET_60", "CUSTOM"])
    .default("NET_30"),
  creditLimit: z.union([z.string(), z.number()]).optional().nullable(),
  taxId: z.string().max(50).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const customerContactSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(40).optional().nullable(),
  mobile: z.string().max(40).optional().nullable(),
  role: z.string().max(100).optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export const customerLocationSchema = z.object({
  name: z.string().min(1).max(200),
  locationType: z.string().max(50).optional().nullable(),
  address1: z.string().max(200).optional().nullable(),
  address2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  county: z.string().max(100).optional().nullable(),
  latitude: z.union([z.string(), z.number()]).optional().nullable(),
  longitude: z.union([z.string(), z.number()]).optional().nullable(),
  leaseName: z.string().max(200).optional().nullable(),
  wellName: z.string().max(200).optional().nullable(),
  rigName: z.string().max(200).optional().nullable(),
  rigNumber: z.string().max(100).optional().nullable(),
  gateInstructions: z.string().max(2000).optional().nullable(),
  directions: z.string().max(5000).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const carrierSchema = z.object({
  legalName: z.string().min(1).max(200),
  dba: z.string().max(200).optional().nullable(),
  mcNumber: z.string().max(50).optional().nullable(),
  usdotNumber: z.string().max(50).optional().nullable(),
  taxId: z.string().max(50).optional().nullable(),
  address1: z.string().max(200).optional().nullable(),
  address2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  paymentTerms: z
    .enum(["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_45", "NET_60", "CUSTOM"])
    .default("NET_30"),
  preferredPaymentMethod: z.string().max(100).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "RESTRICTED", "ARCHIVED"]).default("ACTIVE"),
  approvalStatus: z
    .enum(["PREFERRED", "APPROVED", "PENDING", "RESTRICTED", "INACTIVE"])
    .default("PENDING"),
  safetyNotes: z.string().max(5000).optional().nullable(),
  internalNotes: z.string().max(5000).optional().nullable(),
});

export const driverSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  carrierId: z.string().optional().nullable(),
  driverType: z.enum(["COMPANY", "OWNER_OPERATOR", "CARRIER", "CONTRACTOR"]).default("CARRIER"),
  cdlNumber: z.string().max(50).optional().nullable(),
  cdlState: z.string().max(10).optional().nullable(),
  cdlClass: z.string().max(10).optional().nullable(),
  cdlExpiration: z.string().optional().nullable(),
  medicalCardExpiration: z.string().optional().nullable(),
  twicNumber: z.string().max(50).optional().nullable(),
  twicExpiration: z.string().optional().nullable(),
  status: z
    .enum(["AVAILABLE", "ASSIGNED", "IN_TRANSIT", "OFF_DUTY", "INACTIVE", "OUT_OF_SERVICE"])
    .default("AVAILABLE"),
  emergencyContactName: z.string().max(200).optional().nullable(),
  emergencyContactPhone: z.string().max(40).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const tractorSchema = z.object({
  unitNumber: z.string().min(1).max(50),
  vin: z.string().max(50).optional().nullable(),
  licensePlate: z.string().max(30).optional().nullable(),
  licenseState: z.string().max(10).optional().nullable(),
  year: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  make: z.string().max(50).optional().nullable(),
  model: z.string().max(50).optional().nullable(),
  carrierId: z.string().optional().nullable(),
  status: z
    .enum(["AVAILABLE", "ASSIGNED", "IN_TRANSIT", "MAINTENANCE", "OUT_OF_SERVICE"])
    .default("AVAILABLE"),
  notes: z.string().max(2000).optional().nullable(),
});

export const trailerSchema = z.object({
  unitNumber: z.string().min(1).max(50),
  vin: z.string().max(50).optional().nullable(),
  licensePlate: z.string().max(30).optional().nullable(),
  licenseState: z.string().max(10).optional().nullable(),
  trailerType: z
    .enum(["FLATBED", "STEP_DECK", "DOUBLE_DROP", "RGN", "HOTSHOT", "PIPE_TRAILER", "OTHER"])
    .default("FLATBED"),
  customType: z.string().max(50).optional().nullable(),
  lengthFeet: z.union([z.string(), z.number()]).optional().nullable(),
  axles: z.coerce.number().int().min(1).max(20).optional().nullable(),
  maxPayloadLbs: z.union([z.string(), z.number()]).optional().nullable(),
  carrierId: z.string().optional().nullable(),
  status: z
    .enum(["AVAILABLE", "ASSIGNED", "IN_TRANSIT", "MAINTENANCE", "OUT_OF_SERVICE"])
    .default("AVAILABLE"),
  notes: z.string().max(2000).optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type CarrierInput = z.infer<typeof carrierSchema>;
export type DriverInput = z.infer<typeof driverSchema>;
export type TractorInput = z.infer<typeof tractorSchema>;
export type TrailerInput = z.infer<typeof trailerSchema>;
