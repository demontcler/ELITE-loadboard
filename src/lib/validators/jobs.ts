import { z } from "zod";

export const jobCreateSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  customerPoNumber: z.string().max(100).optional().nullable(),
  customerReferenceNumber: z.string().max(100).optional().nullable(),
  orderNumber: z.string().max(100).optional().nullable(),
  requestedBy: z.string().max(200).optional().nullable(),
  customerContactName: z.string().max(200).optional().nullable(),
  customerContactPhone: z.string().max(40).optional().nullable(),
  jobType: z
    .enum(["OILFIELD", "PIPE", "FLATBED", "EQUIPMENT", "RIG_MATERIALS", "MULTI_TRUCK_PROJECT", "OTHER"])
    .default("OILFIELD"),
  pickupDate: z.string().optional().nullable(),
  pickupTime: z.string().max(20).optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  deliveryTime: z.string().max(20).optional().nullable(),

  pickupName: z.string().max(200).optional().nullable(),
  pickupAddress1: z.string().max(200).optional().nullable(),
  pickupCity: z.string().max(100).optional().nullable(),
  pickupState: z.string().max(50).optional().nullable(),
  pickupZip: z.string().max(20).optional().nullable(),
  pickupCounty: z.string().max(100).optional().nullable(),
  pickupLatitude: z.union([z.string(), z.number()]).optional().nullable(),
  pickupLongitude: z.union([z.string(), z.number()]).optional().nullable(),
  pickupDirections: z.string().max(5000).optional().nullable(),
  pickupGateInstructions: z.string().max(2000).optional().nullable(),
  pickupContactName: z.string().max(200).optional().nullable(),
  pickupContactPhone: z.string().max(40).optional().nullable(),

  deliveryName: z.string().max(200).optional().nullable(),
  deliveryAddress1: z.string().max(200).optional().nullable(),
  deliveryCity: z.string().max(100).optional().nullable(),
  deliveryState: z.string().max(50).optional().nullable(),
  deliveryZip: z.string().max(20).optional().nullable(),
  deliveryCounty: z.string().max(100).optional().nullable(),
  deliveryLatitude: z.union([z.string(), z.number()]).optional().nullable(),
  deliveryLongitude: z.union([z.string(), z.number()]).optional().nullable(),
  deliveryDirections: z.string().max(5000).optional().nullable(),
  deliveryGateInstructions: z.string().max(2000).optional().nullable(),
  deliveryContactName: z.string().max(200).optional().nullable(),
  deliveryContactPhone: z.string().max(40).optional().nullable(),

  rigName: z.string().max(200).optional().nullable(),
  rigNumber: z.string().max(100).optional().nullable(),
  leaseName: z.string().max(200).optional().nullable(),
  wellName: z.string().max(200).optional().nullable(),
  afeNumber: z.string().max(100).optional().nullable(),
  fieldContactName: z.string().max(200).optional().nullable(),
  fieldContactPhone: z.string().max(40).optional().nullable(),

  specialInstructions: z.string().max(5000).optional().nullable(),
  trucksRequired: z.coerce.number().int().min(1).max(200).default(1),
  equipmentRequirements: z.string().max(2000).optional().nullable(),
  customerRate: z.union([z.string(), z.number()]).optional().nullable(),
  billingMethod: z
    .enum(["PER_LOAD", "PER_TRUCK", "PER_MILE", "PER_HOUR", "FLAT_RATE", "PER_FOOT", "OTHER"])
    .default("PER_TRUCK"),
  notes: z.string().max(5000).optional().nullable(),
  status: z
    .enum([
      "DRAFT",
      "SCHEDULED",
      "NEEDS_TRUCKS",
      "PARTIALLY_ASSIGNED",
      "READY",
      "DISPATCHED",
      "PARTIALLY_DISPATCHED",
      "IN_TRANSIT",
      "PARTIALLY_DELIVERED",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ])
    .default("SCHEDULED"),
});

export const truckAssignmentUpdateSchema = z.object({
  carrierId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
  driverPhone: z.string().max(40).optional().nullable(),
  tractorId: z.string().optional().nullable(),
  trailerId: z.string().optional().nullable(),
  trailerType: z
    .enum(["FLATBED", "STEP_DECK", "DOUBLE_DROP", "RGN", "HOTSHOT", "PIPE_TRAILER", "OTHER"])
    .optional()
    .nullable(),
  equipmentType: z.string().max(100).optional().nullable(),
  pickupDate: z.string().optional().nullable(),
  pickupTime: z.string().max(20).optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  deliveryTime: z.string().max(20).optional().nullable(),
  status: z
    .enum([
      "UNASSIGNED",
      "ASSIGNED",
      "CONFIRMED",
      "DISPATCHED",
      "ARRIVED_PICKUP",
      "LOADING",
      "LOADED",
      "IN_TRANSIT",
      "ARRIVED_DELIVERY",
      "UNLOADING",
      "DELIVERED",
      "POD_RECEIVED",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
  carrierRate: z.union([z.string(), z.number()]).optional().nullable(),
  driverRate: z.union([z.string(), z.number()]).optional().nullable(),
  revenueAllocation: z.union([z.string(), z.number()]).optional().nullable(),
  additionalCost: z.union([z.string(), z.number()]).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const cargoItemSchema = z.object({
  materialCategory: z
    .enum([
      "CASING",
      "TUBING",
      "DRILL_PIPE",
      "PRODUCTION_EQUIPMENT",
      "RIG_EQUIPMENT",
      "VALVES",
      "SPOOLS",
      "SKIDS",
      "TANKS",
      "PUMPS",
      "GENERATORS",
      "OILFIELD_TOOLS",
      "FLATBED_FREIGHT",
      "MISCELLANEOUS",
      "CUSTOM",
    ])
    .default("CUSTOM"),
  materialDescription: z.string().min(1).max(500),
  pipeType: z.string().max(100).optional().nullable(),
  pipeGrade: z.string().max(100).optional().nullable(),
  pipeOutsideDiameterIn: z.union([z.string(), z.number()]).optional().nullable(),
  wallThicknessIn: z.union([z.string(), z.number()]).optional().nullable(),
  jointLengthFt: z.union([z.string(), z.number()]).optional().nullable(),
  numberOfJoints: z.coerce.number().int().optional().nullable(),
  totalFootage: z.union([z.string(), z.number()]).optional().nullable(),
  weightPerFoot: z.union([z.string(), z.number()]).optional().nullable(),
  manualWeightOverrideLbs: z.union([z.string(), z.number()]).optional().nullable(),
  heatNumber: z.string().max(100).optional().nullable(),
  bundleCount: z.coerce.number().int().optional().nullable(),
  quantity: z.union([z.string(), z.number()]).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  customerMaterialRef: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
});

export const bulkAssignSchema = z.object({
  truckAssignmentIds: z.array(z.string()).min(1),
  carrierId: z.string().optional().nullable(),
  pickupTime: z.string().optional().nullable(),
  equipmentType: z.string().optional().nullable(),
  trailerType: z
    .enum(["FLATBED", "STEP_DECK", "DOUBLE_DROP", "RGN", "HOTSHOT", "PIPE_TRAILER", "OTHER"])
    .optional()
    .nullable(),
});
