"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import { tractorSchema, trailerSchema } from "@/lib/validators/master-data";
import { ActionError, emptyToNull, parseWithFieldErrors } from "@/lib/validators/form";

export async function listTractors(carrierId?: string) {
  await requireUserPermission("equipment:read");
  return prisma.tractor.findMany({
    where: { deletedAt: null, ...(carrierId ? { carrierId } : {}) },
    include: { carrier: { select: { id: true, legalName: true } } },
    orderBy: { unitNumber: "asc" },
    take: 200,
  });
}

export async function listTrailers(carrierId?: string) {
  await requireUserPermission("equipment:read");
  return prisma.trailer.findMany({
    where: { deletedAt: null, ...(carrierId ? { carrierId } : {}) },
    include: { carrier: { select: { id: true, legalName: true } } },
    orderBy: { unitNumber: "asc" },
    take: 200,
  });
}

export async function getTractor(id: string) {
  await requireUserPermission("equipment:read");
  return prisma.tractor.findFirst({
    where: { id, deletedAt: null },
    include: { carrier: true, documents: { where: { deletedAt: null } } },
  });
}

export async function getTrailer(id: string) {
  await requireUserPermission("equipment:read");
  return prisma.trailer.findFirst({
    where: { id, deletedAt: null },
    include: { carrier: true, documents: { where: { deletedAt: null } } },
  });
}

export async function createTractor(raw: unknown) {
  const session = await requireUserPermission("equipment:write");
  const parsed = parseWithFieldErrors(tractorSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const tractor = await prisma.tractor.create({
    data: {
      unitNumber: data.unitNumber,
      vin: data.vin,
      licensePlate: data.licensePlate,
      licenseState: data.licenseState,
      year: data.year ?? null,
      make: data.make,
      model: data.model,
      carrierId: data.carrierId || null,
      status: data.status,
      notes: data.notes,
    },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "tractor.created",
    entityType: "Tractor",
    entityId: tractor.id,
    newValue: { unitNumber: tractor.unitNumber },
  });
  revalidatePath("/equipment");
  return tractor;
}

export async function updateTractor(id: string, raw: unknown) {
  const session = await requireUserPermission("equipment:write");
  const parsed = parseWithFieldErrors(tractorSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const previous = await prisma.tractor.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new ActionError("Tractor not found");
  const tractor = await prisma.tractor.update({
    where: { id },
    data: {
      unitNumber: data.unitNumber,
      vin: data.vin,
      licensePlate: data.licensePlate,
      licenseState: data.licenseState,
      year: data.year ?? null,
      make: data.make,
      model: data.model,
      carrierId: data.carrierId || null,
      status: data.status,
      notes: data.notes,
    },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "tractor.updated",
    entityType: "Tractor",
    entityId: id,
    previousValue: { status: previous.status },
    newValue: { status: tractor.status },
  });
  revalidatePath("/equipment");
  revalidatePath(`/equipment/tractors/${id}`);
  return tractor;
}

export async function createTrailer(raw: unknown) {
  const session = await requireUserPermission("equipment:write");
  const parsed = parseWithFieldErrors(trailerSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const trailer = await prisma.trailer.create({
    data: {
      unitNumber: data.unitNumber,
      vin: data.vin,
      licensePlate: data.licensePlate,
      licenseState: data.licenseState,
      trailerType: data.trailerType,
      customType: data.customType,
      lengthFeet:
        data.lengthFeet === null || data.lengthFeet === undefined
          ? null
          : new Prisma.Decimal(data.lengthFeet),
      axles: data.axles ?? null,
      maxPayloadLbs:
        data.maxPayloadLbs === null || data.maxPayloadLbs === undefined
          ? null
          : new Prisma.Decimal(data.maxPayloadLbs),
      carrierId: data.carrierId || null,
      status: data.status,
      notes: data.notes,
    },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "trailer.created",
    entityType: "Trailer",
    entityId: trailer.id,
    newValue: { unitNumber: trailer.unitNumber, trailerType: trailer.trailerType },
  });
  revalidatePath("/equipment");
  return trailer;
}

export async function updateTrailer(id: string, raw: unknown) {
  const session = await requireUserPermission("equipment:write");
  const parsed = parseWithFieldErrors(trailerSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const previous = await prisma.trailer.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new ActionError("Trailer not found");
  const trailer = await prisma.trailer.update({
    where: { id },
    data: {
      unitNumber: data.unitNumber,
      vin: data.vin,
      licensePlate: data.licensePlate,
      licenseState: data.licenseState,
      trailerType: data.trailerType,
      customType: data.customType,
      lengthFeet:
        data.lengthFeet === null || data.lengthFeet === undefined
          ? null
          : new Prisma.Decimal(data.lengthFeet),
      axles: data.axles ?? null,
      maxPayloadLbs:
        data.maxPayloadLbs === null || data.maxPayloadLbs === undefined
          ? null
          : new Prisma.Decimal(data.maxPayloadLbs),
      carrierId: data.carrierId || null,
      status: data.status,
      notes: data.notes,
    },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "trailer.updated",
    entityType: "Trailer",
    entityId: id,
    previousValue: { status: previous.status },
    newValue: { status: trailer.status },
  });
  revalidatePath("/equipment");
  revalidatePath(`/equipment/trailers/${id}`);
  return trailer;
}

export async function softDeleteTractor(id: string) {
  const session = await requireUserPermission("equipment:write");
  await prisma.tractor.update({
    where: { id },
    data: { deletedAt: new Date(), status: "OUT_OF_SERVICE" },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "tractor.archived",
    entityType: "Tractor",
    entityId: id,
  });
  revalidatePath("/equipment");
}

export async function softDeleteTrailer(id: string) {
  const session = await requireUserPermission("equipment:write");
  await prisma.trailer.update({
    where: { id },
    data: { deletedAt: new Date(), status: "OUT_OF_SERVICE" },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "trailer.archived",
    entityType: "Trailer",
    entityId: id,
  });
  revalidatePath("/equipment");
}
