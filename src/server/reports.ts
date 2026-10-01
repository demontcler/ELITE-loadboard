"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUserPermission, requireSession } from "@/lib/auth/session";
import { resolveDateRange } from "@/lib/dates/ranges";
import { sumDecimals, calculateProfitability } from "@/lib/calculations/financial";
import { getArAging } from "@/server/accounting";
import { toCsv } from "@/lib/export/csv";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

async function companyTz() {
  const s = await prisma.companySettings.findFirst({ select: { timezone: true } });
  return s?.timezone ?? "America/Chicago";
}

export async function getReportDateRange(params: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}) {
  const timeZone = await companyTz();
  return resolveDateRange({ ...params, timeZone });
}

export async function reportJobsByCustomer(params: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}) {
  await requireUserPermission("reports:read");
  const range = await getReportDateRange(params);
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: range.start, lte: range.end },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      customerId: true,
      trucksRequired: true,
      totalRevenue: true,
      trucks: {
        where: { deletedAt: null },
        select: { totalWeightLbs: true, totalFootage: true },
      },
    },
    take: 2000,
  });
  const byCustomer = new Map<
    string,
    {
      jobs: number;
      trucksRequired: number;
      revenue: Prisma.Decimal;
      weightLbs: Prisma.Decimal;
      footage: Prisma.Decimal;
    }
  >();
  for (const j of jobs) {
    const row = byCustomer.get(j.customerId) ?? {
      jobs: 0,
      trucksRequired: 0,
      revenue: new Prisma.Decimal(0),
      weightLbs: new Prisma.Decimal(0),
      footage: new Prisma.Decimal(0),
    };
    row.jobs += 1;
    row.trucksRequired += j.trucksRequired;
    row.revenue = row.revenue.plus(j.totalRevenue);
    for (const t of j.trucks) {
      row.weightLbs = row.weightLbs.plus(t.totalWeightLbs);
      row.footage = row.footage.plus(t.totalFootage);
    }
    byCustomer.set(j.customerId, row);
  }
  const customers = await prisma.customer.findMany({
    where: { id: { in: [...byCustomer.keys()] } },
    select: { id: true, companyName: true },
  });
  const nameById = new Map(customers.map((c) => [c.id, c.companyName]));
  return {
    range,
    rows: [...byCustomer.entries()]
      .map(([customerId, j]) => ({
        customerId,
        customerName: nameById.get(customerId) ?? "Unknown",
        ...j,
      }))
      .sort((a, b) => Number(b.revenue) - Number(a.revenue)),
  };
}

export async function reportJobsByStatus(params: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}) {
  await requireUserPermission("reports:read");
  const range = await getReportDateRange(params);
  const rows = await prisma.job.groupBy({
    by: ["status"],
    where: {
      deletedAt: null,
      createdAt: { gte: range.start, lte: range.end },
    },
    _count: { id: true },
  });
  return {
    range,
    rows: rows.map((r) => ({ status: r.status, count: r._count.id })).sort((a, b) => b.count - a.count),
  };
}

export async function reportTruckMovements(params: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
  carrierId?: string | null;
  driverId?: string | null;
}) {
  await requireUserPermission("reports:read");
  const range = await getReportDateRange(params);
  const trucks = await prisma.truckAssignment.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: range.start, lte: range.end },
      ...(params.carrierId ? { carrierId: params.carrierId } : {}),
      ...(params.driverId ? { driverId: params.driverId } : {}),
    },
    include: {
      job: { select: { id: true, jobNumber: true, customer: { select: { companyName: true } } } },
      carrier: { select: { legalName: true } },
      driver: { select: { firstName: true, lastName: true } },
      tractor: { select: { unitNumber: true } },
      trailer: { select: { unitNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return { range, rows: trucks };
}

export async function reportLoadsByCarrier(params: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}) {
  await requireUserPermission("reports:read");
  const range = await getReportDateRange(params);
  const rows = await prisma.truckAssignment.groupBy({
    by: ["carrierId"],
    where: {
      deletedAt: null,
      carrierId: { not: null },
      createdAt: { gte: range.start, lte: range.end },
    },
    _count: { id: true },
    _sum: { totalCost: true, carrierRate: true, totalWeightLbs: true, totalFootage: true },
  });
  const carriers = await prisma.carrier.findMany({
    where: { id: { in: rows.map((r) => r.carrierId!).filter(Boolean) } },
    select: { id: true, legalName: true },
  });
  const nameById = new Map(carriers.map((c) => [c.id, c.legalName]));
  return {
    range,
    rows: rows
      .map((r) => ({
        carrierId: r.carrierId!,
        carrierName: nameById.get(r.carrierId!) ?? "Unknown",
        loads: r._count.id,
        cost: r._sum.carrierRate ?? r._sum.totalCost ?? new Prisma.Decimal(0),
        weightLbs: r._sum.totalWeightLbs ?? new Prisma.Decimal(0),
        footage: r._sum.totalFootage ?? new Prisma.Decimal(0),
      }))
      .sort((a, b) => b.loads - a.loads),
  };
}

export async function reportMaterialHauled(params: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}) {
  await requireUserPermission("reports:read");
  const range = await getReportDateRange(params);
  const items = await prisma.cargoItem.findMany({
    where: {
      deletedAt: null,
      truckAssignment: {
        deletedAt: null,
        createdAt: { gte: range.start, lte: range.end },
      },
    },
    select: {
      materialCategory: true,
      materialDescription: true,
      totalFootage: true,
      calculatedWeightLbs: true,
      manualWeightOverrideLbs: true,
    },
    take: 2000,
  });
  const byMaterial = new Map<
    string,
    { category: string; description: string; footage: Prisma.Decimal; weight: Prisma.Decimal; count: number }
  >();
  for (const item of items) {
    const key = `${item.materialCategory}|${item.materialDescription}`;
    const weight = item.manualWeightOverrideLbs ?? item.calculatedWeightLbs ?? new Prisma.Decimal(0);
    const existing = byMaterial.get(key);
    if (existing) {
      existing.footage = existing.footage.plus(item.totalFootage ?? 0);
      existing.weight = existing.weight.plus(weight);
      existing.count += 1;
    } else {
      byMaterial.set(key, {
        category: item.materialCategory,
        description: item.materialDescription,
        footage: new Prisma.Decimal(item.totalFootage?.toString() ?? "0"),
        weight: new Prisma.Decimal(weight.toString()),
        count: 1,
      });
    }
  }
  return {
    range,
    rows: [...byMaterial.values()].sort((a, b) => Number(b.weight) - Number(a.weight)),
  };
}

export async function reportJobsMissingTrucks() {
  await requireUserPermission("reports:read");
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["CANCELLED", "COMPLETED", "DRAFT"] },
    },
    include: {
      customer: { select: { companyName: true } },
      trucks: { where: { deletedAt: null, status: { not: "CANCELLED" } }, select: { id: true } },
    },
    orderBy: { pickupDate: "asc" },
    take: 200,
  });
  return jobs
    .filter((j) => j.trucks.length < j.trucksRequired)
    .map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber,
      customerName: j.customer.companyName,
      required: j.trucksRequired,
      assigned: j.trucks.length,
      needed: j.trucksRequired - j.trucks.length,
      pickupDate: j.pickupDate,
      status: j.status,
    }));
}

export async function reportFinancialSummary(params: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}) {
  const session = await requireUserPermission("reports:read");
  if (!hasPermission(session.user.role as Role, "accounting:read")) {
    throw new Error("Forbidden: financial reports require accounting:read");
  }
  const range = await getReportDateRange(params);
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: range.start, lte: range.end },
      status: { notIn: ["CANCELLED", "DRAFT"] },
    },
    select: {
      id: true,
      jobNumber: true,
      customerId: true,
      totalRevenue: true,
      totalCost: true,
      grossProfit: true,
      marginPercent: true,
      customer: { select: { companyName: true } },
    },
    take: 1000,
  });

  const byCustomer = new Map<
    string,
    { name: string; revenue: Prisma.Decimal; cost: Prisma.Decimal; profit: Prisma.Decimal; jobs: number }
  >();
  const byMonth = new Map<string, { revenue: Prisma.Decimal; profit: Prisma.Decimal }>();

  for (const j of jobs) {
    const c = byCustomer.get(j.customerId) ?? {
      name: j.customer.companyName,
      revenue: new Prisma.Decimal(0),
      cost: new Prisma.Decimal(0),
      profit: new Prisma.Decimal(0),
      jobs: 0,
    };
    c.revenue = c.revenue.plus(j.totalRevenue);
    c.cost = c.cost.plus(j.totalCost);
    c.profit = c.profit.plus(j.grossProfit);
    c.jobs += 1;
    byCustomer.set(j.customerId, c);
  }

  // Month buckets from job list with createdAt
  const jobsDated = await prisma.job.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: range.start, lte: range.end },
      status: { notIn: ["CANCELLED", "DRAFT"] },
    },
    select: { createdAt: true, totalRevenue: true, grossProfit: true },
    take: 2000,
  });
  for (const j of jobsDated) {
    const key = `${j.createdAt.getUTCFullYear()}-${String(j.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const m = byMonth.get(key) ?? { revenue: new Prisma.Decimal(0), profit: new Prisma.Decimal(0) };
    m.revenue = m.revenue.plus(j.totalRevenue);
    m.profit = m.profit.plus(j.grossProfit);
    byMonth.set(key, m);
  }

  const accessorials = await prisma.accessorial.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: range.start, lte: range.end },
    },
    select: { billToCustomer: true, payToCarrier: true, customerAmount: true, carrierAmount: true, amount: true },
  });
  const accessorialRevenue = sumDecimals(
    accessorials.filter((a) => a.billToCustomer).map((a) => (a.customerAmount ?? a.amount).toString())
  );
  const accessorialCost = sumDecimals(
    accessorials.filter((a) => a.payToCarrier).map((a) => (a.carrierAmount ?? a.amount).toString())
  );

  const aging = await getArAging();
  const payables = await prisma.carrierPayable.findMany({
    where: { deletedAt: null, status: { notIn: ["PAID", "VOID"] } },
    select: { totalPayable: true, status: true },
  });

  const totalRevenue = sumDecimals(jobs.map((j) => j.totalRevenue.toString()));
  const totalProfit = sumDecimals(jobs.map((j) => j.grossProfit.toString()));
  const margin = calculateProfitability({
    revenue: totalRevenue,
    cost: totalRevenue.minus(totalProfit),
  });

  return {
    range,
    totals: {
      revenue: totalRevenue,
      profit: totalProfit,
      marginPercent: margin.marginPercent,
      accessorialRevenue,
      accessorialCost,
      outstandingAp: sumDecimals(payables.map((p) => p.totalPayable.toString())),
      apOnHold: payables.filter((p) => p.status === "PAPERWORK_HOLD").length,
    },
    byCustomer: [...byCustomer.entries()]
      .map(([id, v]) => ({
        customerId: id,
        ...v,
        marginPercent: calculateProfitability({ revenue: v.revenue, cost: v.cost }).marginPercent,
      }))
      .sort((a, b) => Number(b.revenue) - Number(a.revenue)),
    byMonth: [...byMonth.entries()]
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    arAging: aging.totals,
    jobs,
  };
}

export async function getCustomerReporting(customerId: string, params?: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}) {
  await requireUserPermission("customers:read");
  const range = await getReportDateRange(params ?? { preset: "year" });
  const [jobs, invoices, trucks] = await Promise.all([
    prisma.job.findMany({
      where: {
        customerId,
        deletedAt: null,
        createdAt: { gte: range.start, lte: range.end },
      },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        totalRevenue: true,
        trucksRequired: true,
        createdAt: true,
        trucks: {
          where: { deletedAt: null },
          select: { totalWeightLbs: true, totalFootage: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.invoice.findMany({
      where: {
        customerId,
        deletedAt: null,
        remainingBalance: { gt: 0 },
        status: { notIn: ["VOID", "DRAFT", "PAID"] },
      },
      select: { remainingBalance: true },
    }),
    prisma.truckAssignment.count({
      where: {
        deletedAt: null,
        job: { customerId, deletedAt: null },
        createdAt: { gte: range.start, lte: range.end },
      },
    }),
  ]);

  const revenue = sumDecimals(jobs.map((j) => j.totalRevenue.toString()));
  const outstandingAr = sumDecimals(invoices.map((i) => i.remainingBalance.toString()));
  const activeJobs = jobs.filter((j) => !["COMPLETED", "CANCELLED", "DRAFT"].includes(j.status)).length;
  const completedJobs = jobs.filter((j) => j.status === "COMPLETED" || j.status === "DELIVERED").length;
  const avgRevenue = jobs.length
    ? revenue.div(jobs.length)
    : new Prisma.Decimal(0);
  const materialWeight = sumDecimals(
    jobs.flatMap((j) => j.trucks.map((t) => t.totalWeightLbs.toString()))
  );
  const materialFootage = sumDecimals(
    jobs.flatMap((j) => j.trucks.map((t) => t.totalFootage.toString()))
  );

  return {
    range,
    totalJobs: jobs.length,
    totalTruckMovements: trucks,
    revenue,
    outstandingAr,
    averageRevenuePerJob: avgRevenue,
    activeJobs,
    completedJobs,
    materialWeight,
    materialFootage,
    recentJobs: jobs.slice(0, 10),
  };
}

export async function getCarrierReporting(carrierId: string, params?: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}) {
  await requireUserPermission("carriers:read");
  const range = await getReportDateRange(params ?? { preset: "year" });
  const [trucks, payables, docs] = await Promise.all([
    prisma.truckAssignment.findMany({
      where: {
        carrierId,
        deletedAt: null,
        createdAt: { gte: range.start, lte: range.end },
      },
      select: {
        id: true,
        displayId: true,
        status: true,
        carrierRate: true,
        totalCost: true,
        job: { select: { jobNumber: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.carrierPayable.findMany({
      where: { carrierId, deletedAt: null },
      select: { totalPayable: true, status: true },
    }),
    prisma.carrierDocument.findMany({
      where: { carrierId, deletedAt: null, isCurrent: true },
      select: { documentType: true, status: true, expirationDate: true },
    }),
  ]);

  const totalCost = sumDecimals(trucks.map((t) => (t.carrierRate ?? t.totalCost).toString()));
  const outstanding = sumDecimals(
    payables.filter((p) => !["PAID", "VOID"].includes(p.status)).map((p) => p.totalPayable.toString())
  );
  const paid = sumDecimals(
    payables.filter((p) => p.status === "PAID").map((p) => p.totalPayable.toString())
  );
  const completed = trucks.filter((t) => ["DELIVERED", "COMPLETED"].includes(t.status)).length;

  return {
    range,
    truckAssignments: trucks.length,
    totalCarrierCost: totalCost,
    outstandingPayables: outstanding,
    paidAmount: paid,
    averageCostPerMovement: trucks.length ? totalCost.div(trucks.length) : new Prisma.Decimal(0),
    loadsCompleted: completed,
    complianceDocs: docs,
    recent: trucks.slice(0, 10),
  };
}

export async function getDriverReporting(driverId: string) {
  await requireUserPermission("drivers:read");
  const [trucks, docs, driver] = await Promise.all([
    prisma.truckAssignment.findMany({
      where: { driverId, deletedAt: null },
      include: {
        job: { select: { jobNumber: true, id: true } },
        tractor: { select: { unitNumber: true } },
        trailer: { select: { unitNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.driverDocument.findMany({
      where: { driverId, deletedAt: null, isCurrent: true },
      select: { documentType: true, status: true, expirationDate: true },
    }),
    prisma.driver.findFirst({
      where: { id: driverId, deletedAt: null },
      select: { firstName: true, lastName: true, status: true },
    }),
  ]);

  const current = trucks.find((t) =>
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
  );

  return {
    driver,
    truckAssignments: trucks.length,
    loadsCompleted: trucks.filter((t) => ["DELIVERED", "COMPLETED"].includes(t.status)).length,
    currentAssignment: current
      ? {
          id: current.id,
          displayId: current.displayId,
          jobNumber: current.job.jobNumber,
          jobId: current.job.id,
          tractor: current.tractor?.unitNumber ?? null,
          trailer: current.trailer?.unitNumber ?? null,
          status: current.status,
        }
      : null,
    documents: docs,
    recent: trucks.slice(0, 10),
  };
}

export async function exportJobsCsv(params: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}) {
  await requireUserPermission("reports:read");
  const range = await getReportDateRange(params);
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: range.start, lte: range.end },
    },
    include: { customer: { select: { companyName: true } } },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  return toCsv(
    ["Job Number", "Customer", "Status", "Trucks Required", "Revenue", "Cost", "Profit", "Pickup Date"],
    jobs.map((j) => [
      j.jobNumber,
      j.customer.companyName,
      j.status,
      j.trucksRequired,
      j.totalRevenue.toString(),
      j.totalCost.toString(),
      j.grossProfit.toString(),
      j.pickupDate?.toISOString().slice(0, 10) ?? "",
    ])
  );
}

export async function exportArAgingCsv() {
  const session = await requireUserPermission("reports:read");
  if (!hasPermission(session.user.role as Role, "accounting:read")) {
    throw new Error("Forbidden");
  }
  const aging = await getArAging();
  const all = [
    ...aging.buckets.current.map((i) => ({ ...i, bucket: "Current" })),
    ...aging.buckets.d1_30.map((i) => ({ ...i, bucket: "1-30" })),
    ...aging.buckets.d31_60.map((i) => ({ ...i, bucket: "31-60" })),
    ...aging.buckets.d61_90.map((i) => ({ ...i, bucket: "61-90" })),
    ...aging.buckets.d90plus.map((i) => ({ ...i, bucket: "90+" })),
  ];
  return toCsv(
    ["Bucket", "Invoice", "Customer", "Job", "Due", "Balance"],
    all.map((i) => [
      i.bucket,
      i.invoiceNumber,
      i.customer.companyName,
      i.job?.jobNumber ?? "",
      (i.dueDate ?? i.invoiceDate).toISOString().slice(0, 10),
      i.remainingBalance.toString(),
    ])
  );
}

export async function exportTruckMovementsCsv(params: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}) {
  await requireUserPermission("reports:read");
  const { rows } = await reportTruckMovements(params);
  return toCsv(
    ["Job", "Truck", "Customer", "Carrier", "Driver", "Tractor", "Trailer", "Status", "Weight"],
    rows.map((t) => [
      t.job.jobNumber,
      t.displayId,
      t.job.customer.companyName,
      t.carrier?.legalName ?? "",
      t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : "",
      t.tractor?.unitNumber ?? "",
      t.trailer?.unitNumber ?? "",
      t.status,
      t.totalWeightLbs.toString(),
    ])
  );
}

export type SavedFilterPrep = {
  id: string;
  label: string;
  href: string;
};

/** Architected filter presets for future saved views. */
export async function listPreparedFilters(): Promise<SavedFilterPrep[]> {
  await requireSession();
  return [
    { id: "my-loads-today", label: "My Loads Today", href: "/load-board?column=today" },
    { id: "needs-trucks", label: "Loads Needing Trucks", href: "/load-board?needsTrucks=1" },
    { id: "missing-pods", label: "Missing PODs", href: "/documents?status=MISSING&entityType=TRUCK_ASSIGNMENT" },
    { id: "invoices-ready", label: "Invoices Ready", href: "/accounting/invoices?status=READY_TO_INVOICE" },
    { id: "expired-carrier-docs", label: "Expired Carrier Documents", href: "/documents?status=EXPIRED&entityType=CARRIER" },
    { id: "ap-holds", label: "AP On Hold", href: "/accounting/holds" },
  ];
}
