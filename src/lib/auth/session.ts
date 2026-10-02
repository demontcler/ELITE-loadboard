import { auth } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
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

/** Friendly ActionError-compatible messages for UI surfaces. */
export function toUserErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message;
  if (msg.startsWith("Forbidden:")) return "You do not have permission to perform this action.";
  if (msg === "Unauthorized") return "Please sign in to continue.";
  if (msg.includes("not found") || msg.includes("Not found")) return msg;
  // Avoid leaking SQL / stack / paths
  if (/select |insert |update |delete |\/home\/|\/var\/|ECONN|prisma/i.test(msg)) {
    return fallback;
  }
  return msg || fallback;
}
