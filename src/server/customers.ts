"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import {
  customerSchema,
  customerContactSchema,
  customerLocationSchema,
} from "@/lib/validators/master-data";
import { Prisma } from "@prisma/client";

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] === "") (out as Record<string, unknown>)[key] = null;
  }
  return out;
}

export async function listCustomers(query?: string) {
  await requireUserPermission("customers:read");
  return prisma.customer.findMany({
    where: {
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { companyName: { contains: query, mode: "insensitive" } },
              { dba: { contains: query, mode: "insensitive" } },
              { mainPhone: { contains: query } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { contacts: true, jobs: true, locations: true } },
    },
    orderBy: { companyName: "asc" },
    take: 100,
  });
}

export async function getCustomer(id: string) {
  await requireUserPermission("customers:read");
  return prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      locations: { where: { deletedAt: null }, orderBy: { name: "asc" } },
      documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "desc" } },
      jobs: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          jobNumber: true,
          status: true,
          pickupDate: true,
          trucksRequired: true,
          totalRevenue: true,
          rigName: true,
        },
      },
    },
  });
}

export async function createCustomer(raw: unknown) {
  const session = await requireUserPermission("customers:write");
  const data = emptyToNull(customerSchema.parse(raw));

  const customer = await prisma.customer.create({
    data: {
      ...data,
      creditLimit:
        data.creditLimit === null || data.creditLimit === undefined
          ? null
          : new Prisma.Decimal(data.creditLimit),
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "customer.created",
    entityType: "Customer",
    entityId: customer.id,
    newValue: { companyName: customer.companyName },
  });

  revalidatePath("/customers");
  return customer;
}

export async function updateCustomer(id: string, raw: unknown) {
  const session = await requireUserPermission("customers:write");
  const data = emptyToNull(customerSchema.parse(raw));

  const previous = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new Error("Customer not found");

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...data,
      creditLimit:
        data.creditLimit === null || data.creditLimit === undefined
          ? null
          : new Prisma.Decimal(data.creditLimit),
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "customer.updated",
    entityType: "Customer",
    entityId: id,
    previousValue: { companyName: previous.companyName, status: previous.status },
    newValue: { companyName: customer.companyName, status: customer.status },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return customer;
}

export async function softDeleteCustomer(id: string) {
  const session = await requireUserPermission("customers:write");
  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date(), status: "ARCHIVED" },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "customer.archived",
    entityType: "Customer",
    entityId: id,
  });
  revalidatePath("/customers");
}

export async function addCustomerContact(customerId: string, raw: unknown) {
  await requireUserPermission("customers:write");
  const data = emptyToNull(customerContactSchema.parse(raw));
  const email = data.email === "" ? null : data.email;
  const contact = await prisma.customerContact.create({
    data: { ...data, email, customerId },
  });
  revalidatePath(`/customers/${customerId}`);
  return contact;
}

export async function addCustomerLocation(customerId: string, raw: unknown) {
  await requireUserPermission("customers:write");
  const data = emptyToNull(customerLocationSchema.parse(raw));
  const location = await prisma.customerLocation.create({
    data: {
      ...data,
      customerId,
      latitude:
        data.latitude === null || data.latitude === undefined
          ? null
          : new Prisma.Decimal(data.latitude),
      longitude:
        data.longitude === null || data.longitude === undefined
          ? null
          : new Prisma.Decimal(data.longitude),
    },
  });
  revalidatePath(`/customers/${customerId}`);
  return location;
}
