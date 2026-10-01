"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import { driverSchema } from "@/lib/validators/master-data";
import { ActionError, emptyToNull, parseWithFieldErrors } from "@/lib/validators/form";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function listDrivers(query?: string, carrierId?: string) {
  await requireUserPermission("drivers:read");
  return prisma.driver.findMany({
    where: {
      deletedAt: null,
      ...(carrierId ? { carrierId } : {}),
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query } },
              { cdlNumber: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      carrier: { select: { id: true, legalName: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 100,
  });
}

export async function getDriver(id: string) {
  await requireUserPermission("drivers:read");
  return prisma.driver.findFirst({
    where: { id, deletedAt: null },
    include: {
      carrier: true,
      documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "desc" } },
      assignments: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 15,
        select: {
          id: true,
          displayId: true,
          status: true,
          pickupDate: true,
          job: { select: { id: true, jobNumber: true } },
        },
      },
    },
  });
}

function toDriverData(data: ReturnType<typeof driverSchema.parse>) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    email: data.email === "" ? null : data.email,
    carrierId: data.carrierId || null,
    driverType: data.driverType,
    cdlNumber: data.cdlNumber,
    cdlState: data.cdlState,
    cdlClass: data.cdlClass,
    cdlExpiration: parseDate(data.cdlExpiration),
    medicalCardExpiration: parseDate(data.medicalCardExpiration),
    twicNumber: data.twicNumber,
    twicExpiration: parseDate(data.twicExpiration),
    status: data.status,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    notes: data.notes,
  };
}

export async function createDriver(raw: unknown) {
  const session = await requireUserPermission("drivers:write");
  const parsed = parseWithFieldErrors(driverSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);

  const driver = await prisma.driver.create({ data: toDriverData(parsed.data) });

  await writeAuditLog({
    userId: session.user.id,
    action: "driver.created",
    entityType: "Driver",
    entityId: driver.id,
    newValue: { name: `${driver.firstName} ${driver.lastName}` },
  });

  revalidatePath("/drivers");
  return driver;
}

export async function updateDriver(id: string, raw: unknown) {
  const session = await requireUserPermission("drivers:write");
  const parsed = parseWithFieldErrors(driverSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);

  const previous = await prisma.driver.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new ActionError("Driver not found");

  const driver = await prisma.driver.update({
    where: { id },
    data: toDriverData(parsed.data),
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "driver.updated",
    entityType: "Driver",
    entityId: id,
    previousValue: { status: previous.status },
    newValue: { status: driver.status },
  });

  revalidatePath("/drivers");
  revalidatePath(`/drivers/${id}`);
  return driver;
}

export async function softDeleteDriver(id: string) {
  const session = await requireUserPermission("drivers:write");
  await prisma.driver.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "driver.archived",
    entityType: "Driver",
    entityId: id,
  });
  revalidatePath("/drivers");
}
