"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import { tractorSchema, trailerSchema } from "@/lib/validators/master-data";

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] === "") (out as Record<string, unknown>)[key] = null;
  }
  return out;
}

export async function listTractors() {
  await requireUserPermission("equipment:read");
  return prisma.tractor.findMany({
    where: { deletedAt: null },
    include: { carrier: { select: { id: true, legalName: true } } },
    orderBy: { unitNumber: "asc" },
    take: 200,
  });
}

export async function listTrailers() {
  await requireUserPermission("equipment:read");
  return prisma.trailer.findMany({
    where: { deletedAt: null },
    include: { carrier: { select: { id: true, legalName: true } } },
    orderBy: { unitNumber: "asc" },
    take: 200,
  });
}

export async function createTractor(raw: unknown) {
  const session = await requireUserPermission("equipment:write");
  const data = emptyToNull(tractorSchema.parse(raw));
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

export async function createTrailer(raw: unknown) {
  const session = await requireUserPermission("equipment:write");
  const data = emptyToNull(trailerSchema.parse(raw));
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
