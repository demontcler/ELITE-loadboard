export type TruckStatusLike =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "CONFIRMED"
  | "DISPATCHED"
  | "ARRIVED_PICKUP"
  | "LOADING"
  | "LOADED"
  | "IN_TRANSIT"
  | "ARRIVED_DELIVERY"
  | "UNLOADING"
  | "DELIVERED"
  | "POD_RECEIVED"
  | "COMPLETED"
  | "CANCELLED";

export type JobStatusLike =
  | "DRAFT"
  | "SCHEDULED"
  | "NEEDS_TRUCKS"
  | "PARTIALLY_ASSIGNED"
  | "READY"
  | "DISPATCHED"
  | "PARTIALLY_DISPATCHED"
  | "IN_TRANSIT"
  | "PARTIALLY_DELIVERED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

const UNASSIGNED = new Set<TruckStatusLike>(["UNASSIGNED"]);
const ASSIGNED_OR_CONFIRMED = new Set<TruckStatusLike>(["ASSIGNED", "CONFIRMED"]);
const DISPATCHED_ACTIVE = new Set<TruckStatusLike>([
  "DISPATCHED",
  "ARRIVED_PICKUP",
  "LOADING",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED_DELIVERY",
  "UNLOADING",
]);
const DELIVERED_DONE = new Set<TruckStatusLike>([
  "DELIVERED",
  "POD_RECEIVED",
  "COMPLETED",
]);

export type TruckProgress = {
  required: number;
  total: number;
  unassigned: number;
  assigned: number;
  dispatched: number;
  delivered: number;
  cancelled: number;
  needed: number;
};

export function summarizeTruckProgress(
  trucksRequired: number,
  statuses: TruckStatusLike[]
): TruckProgress {
  const active = statuses.filter((s) => s !== "CANCELLED");
  const cancelled = statuses.length - active.length;
  const unassigned = active.filter((s) => UNASSIGNED.has(s)).length;
  const assigned = active.filter((s) => ASSIGNED_OR_CONFIRMED.has(s)).length;
  const dispatched = active.filter((s) => DISPATCHED_ACTIVE.has(s)).length;
  const delivered = active.filter((s) => DELIVERED_DONE.has(s)).length;
  const staffed = assigned + dispatched + delivered;
  const needed = Math.max(0, trucksRequired - staffed);

  return {
    required: trucksRequired,
    total: statuses.length,
    unassigned,
    assigned: staffed,
    dispatched: dispatched + delivered,
    delivered,
    cancelled,
    needed,
  };
}

/**
 * Derive parent Job status from truck assignment statuses.
 * Explicit DRAFT / CANCELLED on the job should be preserved by the caller.
 */
export function deriveJobStatus(
  trucksRequired: number,
  statuses: TruckStatusLike[],
  current?: JobStatusLike
): JobStatusLike {
  if (current === "DRAFT" || current === "CANCELLED" || current === "COMPLETED") {
    return current;
  }

  const progress = summarizeTruckProgress(trucksRequired, statuses);
  const active = statuses.filter((s) => s !== "CANCELLED");

  if (active.length === 0 || progress.needed === trucksRequired) {
    return trucksRequired > 0 ? "NEEDS_TRUCKS" : "SCHEDULED";
  }

  if (progress.needed > 0 && progress.assigned > 0) {
    if (progress.dispatched > 0) return "PARTIALLY_DISPATCHED";
    return "PARTIALLY_ASSIGNED";
  }

  if (progress.needed > 0) {
    return "NEEDS_TRUCKS";
  }

  // Fully staffed
  const allDelivered = active.every((s) => DELIVERED_DONE.has(s));
  if (allDelivered) return "DELIVERED";

  const someDelivered = active.some((s) => DELIVERED_DONE.has(s));
  const someDispatched = active.some((s) => DISPATCHED_ACTIVE.has(s));
  const someStillWaiting = active.some(
    (s) => UNASSIGNED.has(s) || ASSIGNED_OR_CONFIRMED.has(s)
  );

  if (someDelivered && (someDispatched || someStillWaiting)) {
    return "PARTIALLY_DELIVERED";
  }

  // Some trucks moving, others still only assigned/confirmed
  if (someDispatched && someStillWaiting) {
    return "PARTIALLY_DISPATCHED";
  }

  if (active.every((s) => DISPATCHED_ACTIVE.has(s) || DELIVERED_DONE.has(s))) {
    const anyInTransit = active.some(
      (s) => s === "IN_TRANSIT" || s === "ARRIVED_DELIVERY" || s === "UNLOADING"
    );
    return anyInTransit ? "IN_TRANSIT" : "DISPATCHED";
  }

  if (active.every((s) => ASSIGNED_OR_CONFIRMED.has(s))) {
    const allConfirmed = active.every((s) => s === "CONFIRMED");
    return allConfirmed ? "READY" : "PARTIALLY_ASSIGNED";
  }

  if (active.every((s) => ASSIGNED_OR_CONFIRMED.has(s) || DISPATCHED_ACTIVE.has(s) || DELIVERED_DONE.has(s))) {
    const allReady = active.every(
      (s) => s === "CONFIRMED" || DISPATCHED_ACTIVE.has(s) || DELIVERED_DONE.has(s)
    );
    return allReady ? "READY" : "PARTIALLY_ASSIGNED";
  }

  return "SCHEDULED";
}

export type LoadBoardColumn = "FUTURE" | "TODAY" | "DISPATCHED";

/**
 * Place a job into Future / Today / Dispatched columns.
 */
export function resolveLoadBoardColumn(
  pickupDate: Date | null | undefined,
  status: JobStatusLike,
  now: Date = new Date()
): LoadBoardColumn {
  const dispatchedStatuses: JobStatusLike[] = [
    "DISPATCHED",
    "PARTIALLY_DISPATCHED",
    "IN_TRANSIT",
    "PARTIALLY_DELIVERED",
  ];

  if (dispatchedStatuses.includes(status)) {
    return "DISPATCHED";
  }

  if (!pickupDate) return "FUTURE";

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (pickupDate >= start && pickupDate <= end) {
    return "TODAY";
  }

  if (pickupDate > end) {
    return "FUTURE";
  }

  // Past dates not yet delivered → treat as Today (ops backlog)
  return "TODAY";
}
