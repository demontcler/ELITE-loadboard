"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import { carrierSchema } from "@/lib/validators/master-data";
import { ActionError, emptyToNull, parseWithFieldErrors } from "@/lib/validators/form";

const carrierContactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  title: z.string().max(100).optional().nullable(),
  email: z.string().email("Enter a valid email").optional().nullable().or(z.literal("")),
  phone: z.string().max(40).optional().nullable(),
  mobile: z.string().max(40).optional().nullable(),
  role: z.string().max(100).optional().nullable(),
  isPrimary: z.boolean().default(false),
});

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
      _count: { select: { drivers: true, tractors: true, trailers: true, documents: true, contacts: true } },
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
  const parsed = parseWithFieldErrors(carrierSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
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
  const parsed = parseWithFieldErrors(carrierSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const email = data.email === "" ? null : data.email;

  const previous = await prisma.carrier.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new ActionError("Carrier not found");

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
    data: { deletedAt: new Date(), status: "ARCHIVED", approvalStatus: "INACTIVE" },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "carrier.archived",
    entityType: "Carrier",
    entityId: id,
  });
  revalidatePath("/carriers");
}

export async function addCarrierContact(carrierId: string, raw: unknown) {
  await requireUserPermission("carriers:write");
  const parsed = parseWithFieldErrors(
    carrierContactSchema,
    emptyToNull(raw as Record<string, unknown>)
  );
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const contact = await prisma.carrierContact.create({
    data: {
      ...data,
      email: data.email === "" ? null : data.email,
      carrierId,
    },
  });
  revalidatePath(`/carriers/${carrierId}`);
  return contact;
}

export async function updateCarrierContact(contactId: string, raw: unknown) {
  await requireUserPermission("carriers:write");
  const parsed = parseWithFieldErrors(
    carrierContactSchema,
    emptyToNull(raw as Record<string, unknown>)
  );
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const existing = await prisma.carrierContact.findFirst({
    where: { id: contactId, deletedAt: null },
  });
  if (!existing) throw new ActionError("Contact not found");
  const contact = await prisma.carrierContact.update({
    where: { id: contactId },
    data: { ...data, email: data.email === "" ? null : data.email },
  });
  revalidatePath(`/carriers/${existing.carrierId}`);
  return contact;
}

export async function softDeleteCarrierContact(contactId: string) {
  await requireUserPermission("carriers:write");
  const existing = await prisma.carrierContact.findFirst({
    where: { id: contactId, deletedAt: null },
  });
  if (!existing) throw new ActionError("Contact not found");
  await prisma.carrierContact.update({
    where: { id: contactId },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/carriers/${existing.carrierId}`);
}
