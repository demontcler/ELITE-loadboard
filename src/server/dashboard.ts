"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { summarizeTruckProgress, type TruckStatusLike } from "@/lib/calculations/job-status";
import { getAccountingOverview } from "@/server/accounting";
import { sumDecimals } from "@/lib/calculations/financial";
import { resolveDateRange } from "@/lib/dates/ranges";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export async function getDashboardMetrics() {
  const session = await requireSession();
  const settings = await prisma.companySettings.findFirst();
  const timeZone = settings?.timezone ?? "America/Chicago";

  const today = resolveDateRange({ preset: "today", timeZone });
  const week = resolveDateRange({ preset: "this_week", timeZone });
  const month = resolveDateRange({ preset: "this_month", timeZone });

  const [todayJobs, futureJobs, activeJobs, deliveredTodayTrucks, jobsNeedingTrucks] =
    await Promise.all([
      prisma.job.count({
        where: {
          deletedAt: null,
          pickupDate: { gte: today.start, lte: today.end },
          status: { notIn: ["CANCELLED", "DRAFT"] },
        },
      }),
      prisma.job.count({
        where: {
          deletedAt: null,
          pickupDate: { gt: today.end },
          status: { notIn: ["CANCELLED", "COMPLETED", "DRAFT"] },
        },
      }),
      prisma.job.findMany({
        where: {
          deletedAt: null,
          status: { notIn: ["CANCELLED", "COMPLETED", "DRAFT"] },
        },
        select: {
          id: true,
          trucksRequired: true,
          trucks: { where: { deletedAt: null }, select: { status: true } },
        },
        take: 500,
      }),
      prisma.truckAssignment.count({
        where: {
          deletedAt: null,
          status: "DELIVERED",
          deliveredAt: { gte: today.start, lte: today.end },
        },
      }),
      prisma.job.findMany({
        where: {
          deletedAt: null,
          status: { notIn: ["CANCELLED", "COMPLETED", "DRAFT"] },
        },
        select: {
          id: true,
          trucksRequired: true,
          _count: { select: { trucks: { where: { deletedAt: null, status: { not: "CANCELLED" } } } } },
        },
        take: 500,
      }),
    ]);

  let activeTrucks = 0;
  let trucksNeeded = 0;
  let trucksDispatched = 0;
  for (const job of activeJobs) {
    const progress = summarizeTruckProgress(
      job.trucksRequired,
      job.trucks.map((t) => t.status as TruckStatusLike)
    );
    trucksNeeded += progress.needed;
    trucksDispatched += progress.dispatched;
    activeTrucks += job.trucks.filter((t) =>
      [
        "ASSIGNED",
        "CONFIRMED",
        "DISPATCHED",
        "ARRIVED_PICKUP",
        "LOADING",
        "LOADED",
        "IN_TRANSIT",
        "ARRIVED_DELIVERY",
        "UNLOADING",
      ].includes(t.status)
    ).length;
  }

  const missingTrucksJobs = jobsNeedingTrucks.filter((j) => j._count.trucks < j.trucksRequired).length;

  // Missing PODs: trucks with BOL but no current POD (or any required missing)
  const trucksWithDocs = await prisma.truckAssignment.findMany({
    where: {
      deletedAt: null,
      status: { in: ["DELIVERED", "COMPLETED", "IN_TRANSIT", "DISPATCHED"] },
    },
    select: {
      id: true,
      documents: {
        where: { deletedAt: null, isCurrent: true },
        select: { documentType: true },
      },
    },
    take: 1000,
  });
  const missingPods = trucksWithDocs.filter((t) => {
    const types = new Set(t.documents.map((d) => d.documentType.toUpperCase()));
    return !types.has("POD");
  }).length;

  const complianceAlerts = await prisma.carrierDocument.count({
    where: {
      deletedAt: null,
      isCurrent: true,
      OR: [{ status: "EXPIRED" }, { status: "EXPIRES_SOON" }],
    },
  }) + await prisma.driverDocument.count({
    where: {
      deletedAt: null,
      isCurrent: true,
      OR: [{ status: "EXPIRED" }, { status: "EXPIRES_SOON" }],
    },
  });

  const canSeeAccounting = hasPermission(session.user.role as Role, "accounting:read");
  let accounting = null;
  if (canSeeAccounting) {
    accounting = await getAccountingOverview();
  }

  // Revenue from jobs in ranges (for non-accounting fallback still show ops)
  const monthJobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: month.start, lte: month.end },
      status: { notIn: ["CANCELLED", "DRAFT"] },
    },
    select: { totalRevenue: true, grossProfit: true },
    take: 2000,
  });
  const weekJobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: week.start, lte: week.end },
      status: { notIn: ["CANCELLED", "DRAFT"] },
    },
    select: { totalRevenue: true },
    take: 2000,
  });

  return {
    timeZone,
    todayJobs,
    futureJobs,
    activeJobs: activeJobs.length,
    activeTrucks,
    trucksNeeded,
    trucksDispatched,
    trucksDeliveredToday: deliveredTodayTrucks,
    jobsMissingTrucks: missingTrucksJobs,
    missingPods,
    complianceAlerts,
    revenueWeek: accounting?.revenueWeek ?? sumDecimals(weekJobs.map((j) => j.totalRevenue.toString())),
    revenueMonth: accounting?.revenueMonth ?? sumDecimals(monthJobs.map((j) => j.totalRevenue.toString())),
    profitMonth: accounting?.profitMonth ?? sumDecimals(monthJobs.map((j) => j.grossProfit.toString())),
    marginMonth: accounting?.marginMonth ?? null,
    invoicesReady: accounting?.invoicesReady ?? null,
    invoicesOnHold: accounting?.invoicesOnHold ?? null,
    outstandingAr: accounting?.outstandingAr ?? null,
    overdueAr: accounting?.overdueAr ?? null,
    outstandingAp: accounting?.outstandingAp ?? null,
    apOnHold: accounting?.apOnHold ?? null,
    canSeeAccounting,
  };
}

export async function getCompanyTimezone() {
  await requireSession();
  const settings = await prisma.companySettings.findFirst({ select: { timezone: true } });
  return settings?.timezone ?? "America/Chicago";
}
