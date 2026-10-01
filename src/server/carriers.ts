"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import { carrierSchema } from "@/lib/validators/master-data";

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] === "") (out as Record<string, unknown>)[key] = null;
  }
  return out;
}

export async function listCarriers(query?: string) {
  await requireUserPermission("carriers:read");
  return prisma.carrier.findMany({
    where: {
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { legalName: { contains: query, mode: "insensitive" } },
              { dba: { contains: query, mode: "insensitive" } },
              { mcNumber: { contains: query, mode: "insensitive" } },
              { usdotNumber: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { drivers: true, tractors: true, trailers: true, documents: true } },
    },
    orderBy: { legalName: "asc" },
    take: 100,
  });
}

export async function getCarrier(id: string) {
  await requireUserPermission("carriers:read");
  return prisma.carrier.findFirst({
    where: { id, deletedAt: null },
    include: {
      contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "desc" } },
      drivers: { where: { deletedAt: null }, orderBy: { lastName: "asc" }, take: 50 },
      tractors: { where: { deletedAt: null }, orderBy: { unitNumber: "asc" } },
      trailers: { where: { deletedAt: null }, orderBy: { unitNumber: "asc" } },
    },
  });
}

export async function createCarrier(raw: unknown) {
  const session = await requireUserPermission("carriers:write");
  const data = emptyToNull(carrierSchema.parse(raw));
  const email = data.email === "" ? null : data.email;

  const carrier = await prisma.carrier.create({
    data: { ...data, email },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "carrier.created",
    entityType: "Carrier",
    entityId: carrier.id,
    newValue: { legalName: carrier.legalName, mcNumber: carrier.mcNumber },
  });

  revalidatePath("/carriers");
  return carrier;
}

export async function updateCarrier(id: string, raw: unknown) {
  const session = await requireUserPermission("carriers:write");
  const data = emptyToNull(carrierSchema.parse(raw));
  const email = data.email === "" ? null : data.email;

  const previous = await prisma.carrier.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new Error("Carrier not found");

  const carrier = await prisma.carrier.update({
    where: { id },
    data: { ...data, email },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "carrier.updated",
    entityType: "Carrier",
    entityId: id,
    previousValue: {
      legalName: previous.legalName,
      approvalStatus: previous.approvalStatus,
    },
    newValue: {
      legalName: carrier.legalName,
      approvalStatus: carrier.approvalStatus,
    },
  });

  revalidatePath("/carriers");
  revalidatePath(`/carriers/${id}`);
  return carrier;
}

export async function softDeleteCarrier(id: string) {
  const session = await requireUserPermission("carriers:write");
  await prisma.carrier.update({
    where: { id },
    data: { deletedAt: new Date(), status: "ARCHIVED" },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "carrier.archived",
    entityType: "Carrier",
    entityId: id,
  });
  revalidatePath("/carriers");
}
