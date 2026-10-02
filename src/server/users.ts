"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import { ActionError, emptyToNull, parseWithFieldErrors } from "@/lib/validators/form";

const ROLES = ["ADMIN", "DISPATCHER", "ACCOUNTING", "OPERATIONS_MANAGER", "VIEW_ONLY"] as const;

export async function listUsers() {
  await requireUserPermission("users:manage");
  return prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { lastName: "asc" }],
    take: 500,
  });
}

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(ROLES),
  temporaryPassword: z.string().min(12),
});

export async function createUser(raw: unknown) {
  const session = await requireUserPermission("users:manage");
  const parsed = parseWithFieldErrors(createSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const email = data.email.toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing && !existing.deletedAt) throw new ActionError("A user with that email already exists");

  const passwordHash = await hash(data.temporaryPassword, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role as Role,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role as Role,
      isActive: true,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "user.created",
    entityType: "User",
    entityId: user.id,
    newValue: { email: user.email, role: user.role },
  });
  revalidatePath("/settings/users");
  return { id: user.id, email: user.email };
}

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES),
});

export async function updateUserRole(raw: unknown) {
  const session = await requireUserPermission("users:manage");
  const parsed = parseWithFieldErrors(roleSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const user = await prisma.user.findFirst({ where: { id: parsed.data.userId, deletedAt: null } });
  if (!user) throw new ActionError("User not found");
  if (user.id === session.user.id && parsed.data.role !== "ADMIN") {
    throw new ActionError("You cannot remove your own ADMIN role");
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: parsed.data.role as Role },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "user.role_changed",
    entityType: "User",
    entityId: user.id,
    previousValue: { role: user.role },
    newValue: { role: updated.role },
  });
  revalidatePath("/settings/users");
  return updated;
}

export async function setUserActive(userId: string, isActive: boolean) {
  const session = await requireUserPermission("users:manage");
  if (userId === session.user.id && !isActive) {
    throw new ActionError("You cannot deactivate your own account");
  }
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new ActionError("User not found");
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: isActive ? "user.reactivated" : "user.deactivated",
    entityType: "User",
    entityId: userId,
    previousValue: { isActive: user.isActive },
    newValue: { isActive },
  });
  revalidatePath("/settings/users");
  return updated;
}
