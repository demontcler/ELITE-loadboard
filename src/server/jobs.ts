"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type TruckAssignmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import { generateDisplayIdInTransaction, formatTruckDisplayId } from "@/lib/identifiers";
import { calculatePipeWeight } from "@/lib/calculations/pipe";
import { summarizeTruckWeight } from "@/lib/calculations/weight";
import { calculateProfitability, sumDecimals } from "@/lib/calculations/financial";
import {
  deriveJobStatus,
  summarizeTruckProgress,
  type TruckStatusLike,
} from "@/lib/calculations/job-status";
import {
  jobCreateSchema,
  truckAssignmentUpdateSchema,
  cargoItemSchema,
  bulkAssignSchema,
} from "@/lib/validators/jobs";
import { ActionError, parseWithFieldErrors } from "@/lib/validators/form";

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] === "") (out as Record<string, unknown>)[key] = null;
  }
  return out;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dec(value: string | number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  return new Prisma.Decimal(value);
}

async function getWeightThreshold(): Promise<number> {
  const settings = await prisma.companySettings.findFirst();
  return settings ? Number(settings.defaultWeightWarningLbs) : 48000;
}

async function recalculateTruckTotals(truckAssignmentId: string) {
  const [items, threshold] = await Promise.all([
    prisma.cargoItem.findMany({
      where: { truckAssignmentId, deletedAt: null },
    }),
    getWeightThreshold(),
  ]);

  const summary = summarizeTruckWeight(
    items.map((i) => ({
      id: i.id,
      materialDescription: i.materialDescription,
      numberOfJoints: i.numberOfJoints,
      jointLengthFt: i.jointLengthFt?.toString(),
      totalFootage: i.totalFootage?.toString(),
      weightPerFoot: i.weightPerFoot?.toString(),
      manualWeightOverrideLbs: i.manualWeightOverrideLbs?.toString(),
    })),
    threshold
  );

  const truck = await prisma.truckAssignment.findUniqueOrThrow({
    where: { id: truckAssignmentId },
  });

  const profit = calculateProfitability({
    revenue: truck.revenueAllocation?.toString() ?? 0,
    cost: truck.carrierRate?.toString() ?? truck.driverRate?.toString() ?? 0,
    additionalCost: sumDecimals([
      truck.accessorialTotal.toString(),
      truck.additionalCost.toString(),
    ]),
  });

  const carrierOrDriver = truck.carrierRate ?? truck.driverRate ?? new Prisma.Decimal(0);

  await prisma.truckAssignment.update({
    where: { id: truckAssignmentId },
    data: {
      totalFootage: new Prisma.Decimal(summary.totalFootage.toFixed(3)),
      totalWeightLbs: new Prisma.Decimal(summary.totalWeightLbs.toFixed(2)),
      weightWarning: summary.exceedsThreshold,
      totalCost: new Prisma.Decimal(
        new Prisma.Decimal(carrierOrDriver.toString())
          .plus(truck.accessorialTotal)
          .plus(truck.additionalCost)
          .toFixed(2)
      ),
      profit: new Prisma.Decimal(profit.grossProfit.toFixed(2)),
      marginPercent: new Prisma.Decimal(profit.marginPercent.toFixed(4)),
    },
  });
}

async function recalculateJobAggregates(jobId: string) {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      trucks: { where: { deletedAt: null } },
    },
  });

  const activeTrucks = job.trucks.filter((t) => t.status !== "CANCELLED");
  const allocationSum = sumDecimals(activeTrucks.map((t) => t.revenueAllocation?.toString()));
  // Prefer explicit customerRate on job when set as total; else sum allocations
  const revenue = job.customerRate
    ? new Prisma.Decimal(job.customerRate.toString())
    : allocationSum;

  const totalCost = sumDecimals(activeTrucks.map((t) => t.totalCost.toString()));
  const totalAdditional = sumDecimals(activeTrucks.map((t) => t.additionalCost.toString()));
  const profit = calculateProfitability({
    revenue,
    cost: totalCost.minus(totalAdditional),
    additionalCost: totalAdditional,
  });

  const statuses = job.trucks.map((t) => t.status as TruckStatusLike);
  const derived =
    job.status === "DRAFT" || job.status === "CANCELLED" || job.status === "COMPLETED"
      ? job.status
      : deriveJobStatus(job.trucksRequired, statuses, job.status);

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: derived,
      totalRevenue: new Prisma.Decimal(profit.revenue.toFixed(2)),
      totalCost: new Prisma.Decimal(profit.cost.plus(profit.additionalCost).toFixed(2)),
      totalAdditionalCost: new Prisma.Decimal(profit.additionalCost.toFixed(2)),
      grossProfit: new Prisma.Decimal(profit.grossProfit.toFixed(2)),
      marginPercent: new Prisma.Decimal(profit.marginPercent.toFixed(4)),
    },
  });
}

export async function listDispatchers() {
  await requireUserPermission("jobs:read");
  return prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      role: { in: ["ADMIN", "DISPATCHER", "OPERATIONS_MANAGER"] },
    },
    select: { id: true, firstName: true, lastName: true, role: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 100,
  });
}

export async function listJobs(filters?: {
  q?: string;
  status?: string;
  customerId?: string;
  dispatcherId?: string;
  carrierId?: string;
  driverId?: string;
  pickupDateFrom?: string;
  pickupDateTo?: string;
  pickupLocation?: string;
  deliveryLocation?: string;
  needsTrucks?: boolean;
}) {
  await requireUserPermission("jobs:read");

  const pickupFrom = filters?.pickupDateFrom ? new Date(filters.pickupDateFrom) : null;
  const pickupTo = filters?.pickupDateTo ? new Date(filters.pickupDateTo) : null;
  if (pickupTo) pickupTo.setHours(23, 59, 59, 999);

  const and: Prisma.JobWhereInput[] = [];
  if (filters?.pickupLocation) {
    and.push({
      OR: [
        { pickupName: { contains: filters.pickupLocation, mode: "insensitive" } },
        { pickupCity: { contains: filters.pickupLocation, mode: "insensitive" } },
        { pickupCounty: { contains: filters.pickupLocation, mode: "insensitive" } },
      ],
    });
  }
  if (filters?.deliveryLocation) {
    and.push({
      OR: [
        { deliveryName: { contains: filters.deliveryLocation, mode: "insensitive" } },
        { deliveryCity: { contains: filters.deliveryLocation, mode: "insensitive" } },
        { deliveryCounty: { contains: filters.deliveryLocation, mode: "insensitive" } },
        { rigName: { contains: filters.deliveryLocation, mode: "insensitive" } },
      ],
    });
  }
  if (filters?.needsTrucks) {
    and.push({
      OR: [
        { status: "NEEDS_TRUCKS" },
        { status: "PARTIALLY_ASSIGNED" },
        { trucks: { some: { deletedAt: null, status: "UNASSIGNED" } } },
      ],
    });
  }
  if (filters?.q) {
    and.push({
      OR: [
        { jobNumber: { contains: filters.q, mode: "insensitive" } },
        { customerPoNumber: { contains: filters.q, mode: "insensitive" } },
        { rigName: { contains: filters.q, mode: "insensitive" } },
        { leaseName: { contains: filters.q, mode: "insensitive" } },
        { wellName: { contains: filters.q, mode: "insensitive" } },
        { customer: { companyName: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }

  return prisma.job.findMany({
    where: {
      deletedAt: null,
      ...(filters?.status ? { status: filters.status as never } : {}),
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      ...(filters?.dispatcherId ? { dispatcherId: filters.dispatcherId } : {}),
      ...(pickupFrom || pickupTo
        ? {
            pickupDate: {
              ...(pickupFrom ? { gte: pickupFrom } : {}),
              ...(pickupTo ? { lte: pickupTo } : {}),
            },
          }
        : {}),
      ...(filters?.carrierId
        ? { trucks: { some: { deletedAt: null, carrierId: filters.carrierId } } }
        : {}),
      ...(filters?.driverId
        ? { trucks: { some: { deletedAt: null, driverId: filters.driverId } } }
        : {}),
      ...(and.length ? { AND: and } : {}),
    },
    include: {
      customer: { select: { id: true, companyName: true } },
      dispatcher: { select: { id: true, firstName: true, lastName: true } },
      trucks: {
        where: { deletedAt: null },
        select: { id: true, status: true, weightWarning: true, carrierId: true, driverId: true },
      },
    },
    orderBy: [{ pickupDate: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function getJob(id: string) {
  await requireUserPermission("jobs:read");
  return prisma.job.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: true,
      dispatcher: { select: { id: true, firstName: true, lastName: true } },
      trucks: {
        where: { deletedAt: null },
        orderBy: { assignmentNumber: "asc" },
        include: {
          carrier: { select: { id: true, legalName: true } },
          driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
          tractor: { select: { id: true, unitNumber: true, make: true, model: true, year: true } },
          trailer: {
            select: { id: true, unitNumber: true, trailerType: true, lengthFeet: true, customType: true },
          },
          cargoItems: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
          documents: { where: { deletedAt: null } },
        },
      },
      documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "desc" } },
    },
  });
}

export async function createJob(raw: unknown) {
  const session = await requireUserPermission("jobs:write");
  const parsed = parseWithFieldErrors(jobCreateSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const trucksRequired = data.trucksRequired ?? 1;

  const job = await prisma.$transaction(async (tx) => {
    const jobNumber = await generateDisplayIdInTransaction(tx, "job");

    const created = await tx.job.create({
      data: {
        jobNumber,
        customerId: data.customerId,
        customerPoNumber: data.customerPoNumber,
        customerReferenceNumber: data.customerReferenceNumber,
        orderNumber: data.orderNumber,
        requestedBy: data.requestedBy,
        customerContactName: data.customerContactName,
        customerContactPhone: data.customerContactPhone,
        jobType: data.jobType,
        status: data.status === "DRAFT" ? "DRAFT" : trucksRequired > 0 ? "NEEDS_TRUCKS" : "SCHEDULED",
        pickupDate: parseDate(data.pickupDate),
        pickupTime: data.pickupTime,
        deliveryDate: parseDate(data.deliveryDate),
        deliveryTime: data.deliveryTime,
        pickupName: data.pickupName,
        pickupAddress1: data.pickupAddress1,
        pickupCity: data.pickupCity,
        pickupState: data.pickupState,
        pickupZip: data.pickupZip,
        pickupCounty: data.pickupCounty,
        pickupLatitude: dec(data.pickupLatitude as string | number | null),
        pickupLongitude: dec(data.pickupLongitude as string | number | null),
        pickupDirections: data.pickupDirections,
        pickupGateInstructions: data.pickupGateInstructions,
        pickupContactName: data.pickupContactName,
        pickupContactPhone: data.pickupContactPhone,
        deliveryName: data.deliveryName,
        deliveryAddress1: data.deliveryAddress1,
        deliveryCity: data.deliveryCity,
        deliveryState: data.deliveryState,
        deliveryZip: data.deliveryZip,
        deliveryCounty: data.deliveryCounty,
        deliveryLatitude: dec(data.deliveryLatitude as string | number | null),
        deliveryLongitude: dec(data.deliveryLongitude as string | number | null),
        deliveryDirections: data.deliveryDirections,
        deliveryGateInstructions: data.deliveryGateInstructions,
        deliveryContactName: data.deliveryContactName,
        deliveryContactPhone: data.deliveryContactPhone,
        rigName: data.rigName,
        rigNumber: data.rigNumber,
        leaseName: data.leaseName,
        wellName: data.wellName,
        afeNumber: data.afeNumber,
        fieldContactName: data.fieldContactName,
        fieldContactPhone: data.fieldContactPhone,
        specialInstructions: data.specialInstructions,
        trucksRequired,
        equipmentRequirements: data.equipmentRequirements,
        customerRate: dec(data.customerRate as string | number | null),
        billingMethod: data.billingMethod,
        notes: data.notes,
        dispatcherId: session.user.id,
      },
    });

    // Generate independent truck assignment slots
    for (let i = 1; i <= trucksRequired; i++) {
      await tx.truckAssignment.create({
        data: {
          jobId: created.id,
          assignmentNumber: i,
          displayId: formatTruckDisplayId(i),
          status: "UNASSIGNED",
          pickupDate: parseDate(data.pickupDate),
          pickupTime: data.pickupTime,
          deliveryDate: parseDate(data.deliveryDate),
          deliveryTime: data.deliveryTime,
          dispatcherId: session.user.id,
        },
      });
    }

    return created;
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "job.created",
    entityType: "Job",
    entityId: job.id,
    newValue: { jobNumber: job.jobNumber, trucksRequired },
  });

  revalidatePath("/load-board");
  revalidatePath("/customers");
  return job;
}

export async function addTruckAssignments(jobId: string, count: number = 1) {
  const session = await requireUserPermission("jobs:write");
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: { trucks: { where: { deletedAt: null }, orderBy: { assignmentNumber: "desc" }, take: 1 } },
  });
  if (!job) throw new Error("Job not found");

  const start = (job.trucks[0]?.assignmentNumber ?? 0) + 1;
  const toAdd = Math.max(1, Math.min(count, 50));

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < toAdd; i++) {
      const num = start + i;
      await tx.truckAssignment.create({
        data: {
          jobId,
          assignmentNumber: num,
          displayId: formatTruckDisplayId(num),
          status: "UNASSIGNED",
          pickupDate: job.pickupDate,
          pickupTime: job.pickupTime,
          deliveryDate: job.deliveryDate,
          deliveryTime: job.deliveryTime,
          dispatcherId: session.user.id,
        },
      });
    }
    await tx.job.update({
      where: { id: jobId },
      data: { trucksRequired: job.trucksRequired + toAdd },
    });
  });

  await recalculateJobAggregates(jobId);
  await writeAuditLog({
    userId: session.user.id,
    action: "job.trucks_added",
    entityType: "Job",
    entityId: jobId,
    newValue: { added: toAdd },
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/load-board");
}

export async function duplicateTruckAssignment(truckAssignmentId: string) {
  const session = await requireUserPermission("jobs:write");
  const source = await prisma.truckAssignment.findFirst({
    where: { id: truckAssignmentId, deletedAt: null },
    include: { cargoItems: { where: { deletedAt: null } } },
  });
  if (!source) throw new Error("Truck assignment not found");

  const last = await prisma.truckAssignment.findFirst({
    where: { jobId: source.jobId, deletedAt: null },
    orderBy: { assignmentNumber: "desc" },
  });
  const nextNum = (last?.assignmentNumber ?? 0) + 1;

  const created = await prisma.$transaction(async (tx) => {
    const truck = await tx.truckAssignment.create({
      data: {
        jobId: source.jobId,
        assignmentNumber: nextNum,
        displayId: formatTruckDisplayId(nextNum),
        carrierId: source.carrierId,
        trailerType: source.trailerType,
        equipmentType: source.equipmentType,
        pickupDate: source.pickupDate,
        pickupTime: source.pickupTime,
        deliveryDate: source.deliveryDate,
        deliveryTime: source.deliveryTime,
        carrierRate: source.carrierRate,
        status: "UNASSIGNED",
        dispatcherId: session.user.id,
        notes: source.notes,
      },
    });

    for (const item of source.cargoItems) {
      await tx.cargoItem.create({
        data: {
          truckAssignmentId: truck.id,
          sortOrder: item.sortOrder,
          materialCategory: item.materialCategory,
          materialDescription: item.materialDescription,
          pipeType: item.pipeType,
          pipeGrade: item.pipeGrade,
          pipeOutsideDiameterIn: item.pipeOutsideDiameterIn,
          wallThicknessIn: item.wallThicknessIn,
          jointLengthFt: item.jointLengthFt,
          numberOfJoints: item.numberOfJoints,
          totalFootage: item.totalFootage,
          weightPerFoot: item.weightPerFoot,
          calculatedWeightLbs: item.calculatedWeightLbs,
          manualWeightOverrideLbs: item.manualWeightOverrideLbs,
          heatNumber: item.heatNumber,
          bundleCount: item.bundleCount,
          quantity: item.quantity,
          unit: item.unit,
          customerMaterialRef: item.customerMaterialRef,
          notes: item.notes,
        },
      });
    }

    const job = await tx.job.findUniqueOrThrow({ where: { id: source.jobId } });
    await tx.job.update({
      where: { id: source.jobId },
      data: { trucksRequired: job.trucksRequired + 1 },
    });

    return truck;
  });

  await recalculateTruckTotals(created.id);
  await recalculateJobAggregates(source.jobId);
  revalidatePath(`/jobs/${source.jobId}`);
  return created;
}

export async function removeTruckAssignment(truckAssignmentId: string) {
  const session = await requireUserPermission("jobs:write");
  const truck = await prisma.truckAssignment.findFirst({
    where: { id: truckAssignmentId, deletedAt: null },
  });
  if (!truck) throw new Error("Truck assignment not found");

  if (["DISPATCHED", "IN_TRANSIT", "DELIVERED", "COMPLETED", "POD_RECEIVED"].includes(truck.status)) {
    throw new Error("Cannot remove a truck that is already in progress or completed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.truckAssignment.update({
      where: { id: truckAssignmentId },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    });
    const job = await tx.job.findUniqueOrThrow({ where: { id: truck.jobId } });
    await tx.job.update({
      where: { id: truck.jobId },
      data: { trucksRequired: Math.max(0, job.trucksRequired - 1) },
    });
  });

  await recalculateJobAggregates(truck.jobId);
  await writeAuditLog({
    userId: session.user.id,
    action: "job.truck_removed",
    entityType: "TruckAssignment",
    entityId: truckAssignmentId,
  });
  revalidatePath(`/jobs/${truck.jobId}`);
  revalidatePath("/load-board");
}

export async function updateTruckAssignment(id: string, raw: unknown) {
  const session = await requireUserPermission("jobs:write");
  const parsed = parseWithFieldErrors(
    truckAssignmentUpdateSchema,
    emptyToNull(raw as Record<string, unknown>)
  );
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const previous = await prisma.truckAssignment.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new ActionError("Truck assignment not found");

  let status = data.status as TruckAssignmentStatus | undefined;
  const hasAssignment = data.carrierId || data.driverId || previous.carrierId || previous.driverId;
  if (!status) {
    if (hasAssignment && previous.status === "UNASSIGNED") {
      status = "ASSIGNED";
    }
  }

  const updated = await prisma.truckAssignment.update({
    where: { id },
    data: {
      carrierId: data.carrierId === undefined ? undefined : data.carrierId || null,
      driverId: data.driverId === undefined ? undefined : data.driverId || null,
      driverPhone: data.driverPhone,
      tractorId: data.tractorId === undefined ? undefined : data.tractorId || null,
      trailerId: data.trailerId === undefined ? undefined : data.trailerId || null,
      trailerType: data.trailerType === undefined ? undefined : data.trailerType,
      equipmentType: data.equipmentType,
      pickupDate: data.pickupDate !== undefined ? parseDate(data.pickupDate) : undefined,
      pickupTime: data.pickupTime,
      deliveryDate: data.deliveryDate !== undefined ? parseDate(data.deliveryDate) : undefined,
      deliveryTime: data.deliveryTime,
      status,
      carrierRate: data.carrierRate !== undefined ? dec(data.carrierRate as string | number | null) : undefined,
      driverRate: data.driverRate !== undefined ? dec(data.driverRate as string | number | null) : undefined,
      revenueAllocation:
        data.revenueAllocation !== undefined
          ? dec(data.revenueAllocation as string | number | null)
          : undefined,
      additionalCost:
        data.additionalCost !== undefined
          ? dec(data.additionalCost as string | number | null) ?? new Prisma.Decimal(0)
          : undefined,
      notes: data.notes,
      dispatchedAt:
        status === "DISPATCHED" && !previous.dispatchedAt ? new Date() : undefined,
      deliveredAt:
        (status === "DELIVERED" || status === "POD_RECEIVED" || status === "COMPLETED") &&
        !previous.deliveredAt
          ? new Date()
          : undefined,
    },
  });

  await recalculateTruckTotals(id);
  await recalculateJobAggregates(previous.jobId);

  await writeAuditLog({
    userId: session.user.id,
    action: "truck.updated",
    entityType: "TruckAssignment",
    entityId: id,
    previousValue: { status: previous.status, driverId: previous.driverId, carrierId: previous.carrierId },
    newValue: { status: updated.status, driverId: updated.driverId, carrierId: updated.carrierId },
  });

  revalidatePath(`/jobs/${previous.jobId}`);
  revalidatePath("/load-board");
  return updated;
}

export async function bulkUpdateTrucks(raw: unknown) {
  await requireUserPermission("jobs:write");
  const parsed = parseWithFieldErrors(bulkAssignSchema, raw);
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;

  function parseDateLocal(value: string | null | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const trucks = await prisma.truckAssignment.findMany({
    where: { id: { in: data.truckAssignmentIds }, deletedAt: null },
  });
  if (trucks.length === 0) throw new ActionError("No trucks selected");

  const pickupDate = data.pickupDate !== undefined ? parseDateLocal(data.pickupDate) : undefined;

  for (const truck of trucks) {
    const nextStatus =
      data.carrierId && truck.status === "UNASSIGNED"
        ? ("ASSIGNED" as const)
        : undefined;
    await prisma.truckAssignment.update({
      where: { id: truck.id },
      data: {
        ...(data.carrierId ? { carrierId: data.carrierId } : {}),
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(pickupDate !== undefined ? { pickupDate } : {}),
        ...(data.pickupTime ? { pickupTime: data.pickupTime } : {}),
        ...(data.equipmentType ? { equipmentType: data.equipmentType } : {}),
        ...(data.trailerType ? { trailerType: data.trailerType } : {}),
      },
    });
  }

  const jobId = trucks[0]!.jobId;
  await recalculateJobAggregates(jobId);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/load-board");
}

/**
 * Soft-archive a job and its truck assignments.
 * Historical rows remain in the database with deletedAt set; they are excluded
 * from operational lists (load board, customer history active views).
 * Financial/audit records are never hard-deleted.
 */
export async function softDeleteJob(id: string) {
  const session = await requireUserPermission("jobs:write");
  const job = await prisma.job.findFirst({ where: { id, deletedAt: null } });
  if (!job) throw new Error("Job not found");
  if (job.status === "COMPLETED") {
    throw new Error("Completed jobs cannot be archived from operations; mark cancelled instead if needed.");
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.job.update({
      where: { id },
      data: { deletedAt: now, status: job.status === "CANCELLED" ? "CANCELLED" : "CANCELLED", cancelledAt: now },
    }),
    prisma.truckAssignment.updateMany({
      where: { jobId: id, deletedAt: null },
      data: { deletedAt: now, status: "CANCELLED" },
    }),
  ]);

  await writeAuditLog({
    userId: session.user.id,
    action: "job.archived",
    entityType: "Job",
    entityId: id,
    previousValue: { status: job.status },
  });

  revalidatePath("/load-board");
  revalidatePath(`/jobs/${id}`);
}

export async function addCargoItem(truckAssignmentId: string, raw: unknown) {
  const session = await requireUserPermission("jobs:write");
  const parsed = parseWithFieldErrors(cargoItemSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;

  const truck = await prisma.truckAssignment.findFirst({
    where: { id: truckAssignmentId, deletedAt: null },
  });
  if (!truck) throw new ActionError("Truck assignment not found");

  const calc = calculatePipeWeight({
    numberOfJoints: data.numberOfJoints,
    jointLengthFt: data.jointLengthFt as string | number | null,
    totalFootage: data.totalFootage as string | number | null,
    weightPerFoot: data.weightPerFoot as string | number | null,
    manualWeightOverrideLbs: data.manualWeightOverrideLbs as string | number | null,
  });

  const item = await prisma.cargoItem.create({
    data: {
      truckAssignmentId,
      sortOrder: data.sortOrder ?? 0,
      materialCategory: data.materialCategory,
      materialDescription: data.materialDescription,
      pipeType: data.pipeType,
      pipeGrade: data.pipeGrade,
      pipeOutsideDiameterIn: dec(data.pipeOutsideDiameterIn as string | number | null),
      wallThicknessIn: dec(data.wallThicknessIn as string | number | null),
      jointLengthFt: dec(data.jointLengthFt as string | number | null),
      numberOfJoints: data.numberOfJoints ?? null,
      totalFootage: new Prisma.Decimal(calc.totalFootage.toFixed(3)),
      weightPerFoot: dec(data.weightPerFoot as string | number | null),
      calculatedWeightLbs: new Prisma.Decimal(calc.calculatedWeightLbs.toFixed(2)),
      manualWeightOverrideLbs: dec(data.manualWeightOverrideLbs as string | number | null),
      heatNumber: data.heatNumber,
      bundleCount: data.bundleCount ?? null,
      quantity: dec(data.quantity as string | number | null),
      unit: data.unit,
      customerMaterialRef: data.customerMaterialRef,
      notes: data.notes,
    },
  });

  await recalculateTruckTotals(truckAssignmentId);
  await recalculateJobAggregates(truck.jobId);

  await writeAuditLog({
    userId: session.user.id,
    action: "cargo.added",
    entityType: "CargoItem",
    entityId: item.id,
    newValue: {
      materialDescription: item.materialDescription,
      weight: item.calculatedWeightLbs?.toString(),
    },
  });

  revalidatePath(`/jobs/${truck.jobId}`);
  return item;
}

export async function removeCargoItem(cargoItemId: string) {
  const session = await requireUserPermission("jobs:write");
  const item = await prisma.cargoItem.findFirst({
    where: { id: cargoItemId, deletedAt: null },
    include: { truckAssignment: true },
  });
  if (!item) throw new Error("Cargo item not found");

  await prisma.cargoItem.update({
    where: { id: cargoItemId },
    data: { deletedAt: new Date() },
  });

  await recalculateTruckTotals(item.truckAssignmentId);
  await recalculateJobAggregates(item.truckAssignment.jobId);

  await writeAuditLog({
    userId: session.user.id,
    action: "cargo.removed",
    entityType: "CargoItem",
    entityId: cargoItemId,
  });

  revalidatePath(`/jobs/${item.truckAssignment.jobId}`);
}

export async function getJobProgress(jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: { trucks: { where: { deletedAt: null }, select: { status: true } } },
  });
  if (!job) return null;
  return summarizeTruckProgress(
    job.trucksRequired,
    job.trucks.map((t) => t.status as TruckStatusLike)
  );
}
