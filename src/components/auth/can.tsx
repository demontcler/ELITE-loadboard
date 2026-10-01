"use client";

import { createContext, useContext } from "react";
import type { Permission } from "@/lib/permissions";
import type { Role } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

type AuthContextValue = {
  role: Role;
  permissions: Permission[];
  userId: string;
  userName: string;
};

const AuthzContext = createContext<AuthContextValue | null>(null);

export function AuthzProvider({
  value,
  children,
}: {
  value: AuthContextValue;
  children: React.ReactNode;
}) {
  return <AuthzContext.Provider value={value}>{children}</AuthzContext.Provider>;
}

export function useAuthz() {
  const ctx = useContext(AuthzContext);
  if (!ctx) {
    throw new Error("useAuthz must be used within AuthzProvider");
  }
  return ctx;
}

export function useCan(permission: Permission): boolean {
  const { role } = useAuthz();
  return hasPermission(role, permission);
}

export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const allowed = useCan(permission);
  return <>{allowed ? children : fallback}</>;
}
