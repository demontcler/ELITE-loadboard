import type { Role } from "@prisma/client";

export type Permission =
  | "jobs:read"
  | "jobs:write"
  | "jobs:dispatch"
  | "customers:read"
  | "customers:write"
  | "carriers:read"
  | "carriers:write"
  | "drivers:read"
  | "drivers:write"
  | "equipment:read"
  | "equipment:write"
  | "documents:read"
  | "documents:write"
  | "accounting:read"
  | "accounting:write"
  | "accounting:approve_payment"
  | "reports:read"
  | "settings:read"
  | "settings:write"
  | "users:manage"
  | "audit:read";

const ALL: Permission[] = [
  "jobs:read",
  "jobs:write",
  "jobs:dispatch",
  "customers:read",
  "customers:write",
  "carriers:read",
  "carriers:write",
  "drivers:read",
  "drivers:write",
  "equipment:read",
  "equipment:write",
  "documents:read",
  "documents:write",
  "accounting:read",
  "accounting:write",
  "accounting:approve_payment",
  "reports:read",
  "settings:read",
  "settings:write",
  "users:manage",
  "audit:read",
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ALL,
  DISPATCHER: [
    "jobs:read",
    "jobs:write",
    "jobs:dispatch",
    "customers:read",
    "customers:write",
    "carriers:read",
    "carriers:write",
    "drivers:read",
    "drivers:write",
    "equipment:read",
    "equipment:write",
    "documents:read",
    "documents:write",
    "accounting:read",
    "reports:read",
    "settings:read",
  ],
  ACCOUNTING: [
    "jobs:read",
    "customers:read",
    "carriers:read",
    "drivers:read",
    "equipment:read",
    "documents:read",
    "documents:write",
    "accounting:read",
    "accounting:write",
    "accounting:approve_payment",
    "reports:read",
    "settings:read",
  ],
  OPERATIONS_MANAGER: [
    "jobs:read",
    "jobs:write",
    "jobs:dispatch",
    "customers:read",
    "carriers:read",
    "drivers:read",
    "equipment:read",
    "documents:read",
    "accounting:read",
    "reports:read",
    "settings:read",
    "audit:read",
  ],
  VIEW_ONLY: [
    "jobs:read",
    "customers:read",
    "carriers:read",
    "drivers:read",
    "equipment:read",
    "documents:read",
    "accounting:read",
    "reports:read",
  ],
};

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}
