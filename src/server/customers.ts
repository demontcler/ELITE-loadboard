"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import {
  customerSchema,
  customerContactSchema,
  customerLocationSchema,
} from "@/lib/validators/master-data";
import { ActionError, emptyToNull, parseWithFieldErrors } from "@/lib/validators/form";

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
  const parsed = parseWithFieldErrors(customerSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;

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
  const parsed = parseWithFieldErrors(customerSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;

  const previous = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!previous) throw new ActionError("Customer not found");

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
  const parsed = parseWithFieldErrors(
    customerContactSchema,
    emptyToNull(raw as Record<string, unknown>)
  );
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const email = data.email === "" ? null : data.email;
  const contact = await prisma.customerContact.create({
    data: { ...data, email, customerId },
  });
  revalidatePath(`/customers/${customerId}`);
  return contact;
}

export async function updateCustomerContact(contactId: string, raw: unknown) {
  await requireUserPermission("customers:write");
  const parsed = parseWithFieldErrors(
    customerContactSchema,
    emptyToNull(raw as Record<string, unknown>)
  );
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const existing = await prisma.customerContact.findFirst({
    where: { id: contactId, deletedAt: null },
  });
  if (!existing) throw new ActionError("Contact not found");
  const contact = await prisma.customerContact.update({
    where: { id: contactId },
    data: { ...data, email: data.email === "" ? null : data.email },
  });
  revalidatePath(`/customers/${existing.customerId}`);
  return contact;
}

export async function softDeleteCustomerContact(contactId: string) {
  await requireUserPermission("customers:write");
  const existing = await prisma.customerContact.findFirst({
    where: { id: contactId, deletedAt: null },
  });
  if (!existing) throw new ActionError("Contact not found");
  await prisma.customerContact.update({
    where: { id: contactId },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/customers/${existing.customerId}`);
}

export async function addCustomerLocation(customerId: string, raw: unknown) {
  await requireUserPermission("customers:write");
  const parsed = parseWithFieldErrors(
    customerLocationSchema,
    emptyToNull(raw as Record<string, unknown>)
  );
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
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

export async function updateCustomerLocation(locationId: string, raw: unknown) {
  await requireUserPermission("customers:write");
  const parsed = parseWithFieldErrors(
    customerLocationSchema,
    emptyToNull(raw as Record<string, unknown>)
  );
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const existing = await prisma.customerLocation.findFirst({
    where: { id: locationId, deletedAt: null },
  });
  if (!existing) throw new ActionError("Location not found");
  const location = await prisma.customerLocation.update({
    where: { id: locationId },
    data: {
      ...data,
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
  revalidatePath(`/customers/${existing.customerId}`);
  return location;
}

export async function softDeleteCustomerLocation(locationId: string) {
  await requireUserPermission("customers:write");
  const existing = await prisma.customerLocation.findFirst({
    where: { id: locationId, deletedAt: null },
  });
  if (!existing) throw new ActionError("Location not found");
  await prisma.customerLocation.update({
    where: { id: locationId },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/customers/${existing.customerId}`);
}
