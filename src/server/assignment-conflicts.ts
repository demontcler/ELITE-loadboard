"use server";

import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";

const ACTIVE_STATUSES = [
  "ASSIGNED",
  "CONFIRMED",
  "DISPATCHED",
  "ARRIVED_PICKUP",
  "LOADING",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED_DELIVERY",
  "UNLOADING",
] as const;

export type AssignmentConflict = {
  kind: "TRACTOR" | "TRAILER" | "DRIVER";
  message: string;
  otherTruckDisplayId: string;
  otherJobNumber: string;
  otherJobId: string;
};

/**
 * Detect overlapping active equipment/driver assignments.
 * Returns warnings only — does not hard-block (operations may override).
 */
export async function getAssignmentConflicts(params: {
  truckAssignmentId?: string | null;
  tractorId?: string | null;
  trailerId?: string | null;
  driverId?: string | null;
}): Promise<AssignmentConflict[]> {
  await requireUserPermission("jobs:read");
  const conflicts: AssignmentConflict[] = [];

  async function findConflicts(
    field: "tractorId" | "trailerId" | "driverId",
    value: string | null | undefined,
    kind: AssignmentConflict["kind"],
    label: string
  ) {
    if (!value) return;
    const rows = await prisma.truckAssignment.findMany({
      where: {
        deletedAt: null,
        status: { in: [...ACTIVE_STATUSES] },
        [field]: value,
        ...(params.truckAssignmentId ? { id: { not: params.truckAssignmentId } } : {}),
      },
      select: {
        displayId: true,
        job: { select: { id: true, jobNumber: true } },
      },
      take: 5,
    });
    for (const r of rows) {
      conflicts.push({
        kind,
        message: `${label} is already on active movement ${r.displayId} (${r.job.jobNumber})`,
        otherTruckDisplayId: r.displayId,
        otherJobNumber: r.job.jobNumber,
        otherJobId: r.job.id,
      });
    }
  }

  await Promise.all([
    findConflicts("tractorId", params.tractorId, "TRACTOR", "Tractor"),
    findConflicts("trailerId", params.trailerId, "TRAILER", "Trailer"),
    findConflicts("driverId", params.driverId, "DRIVER", "Driver"),
  ]);

  return conflicts;
}
