import { auth } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireUserPermission(permission: Permission) {
  const session = await requireSession();
  if (!hasPermission(session.user.role as Role, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
  return session;
}
