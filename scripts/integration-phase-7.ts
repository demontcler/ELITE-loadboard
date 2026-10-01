/**
 * Phase 7 integration tests — dashboard ranges, search indexes, CSV, reporting math.
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { resolveDateRange, zonedDayStart } from "../src/lib/dates/ranges";
import { toCsv } from "../src/lib/export/csv";
import { sumDecimals, calculateProfitability } from "../src/lib/calculations/financial";

const prisma = new PrismaClient();
const results: { name: string; ok: boolean; detail?: string }[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

async function main() {
  console.log("ELITE Loadboard — Phase 7 integration tests");
  const stamp = Date.now();
  const tz = "America/Chicago";

  // Date ranges
  try {
    const today = resolveDateRange({ preset: "today", timeZone: tz });
    const month = resolveDateRange({ preset: "this_month", timeZone: tz });
    const custom = resolveDateRange({
      preset: "custom",
      start: "2026-01-01",
      end: "2026-01-31",
      timeZone: tz,
    });
    assert.ok(today.start <= today.end);
    assert.ok(month.start <= month.end);
    assert.equal(custom.label.includes("2026-01-01"), true);
    const z = zonedDayStart(2026, 6, 15, tz);
    assert.ok(z instanceof Date);
    pass("date range presets resolve with company timezone");
  } catch (e) {
    fail("date ranges", String(e));
  }

  // CSV helper
  try {
    const csv = toCsv(
      ["A", "B"],
      [
        ["x", "y"],
        ['say "hi"', "line\n2"],
      ]
    );
    assert.ok(csv.includes('"say ""hi"""'));
    assert.ok(csv.split("\n").length >= 3);
    pass("CSV export escaping");
  } catch (e) {
    fail("csv", String(e));
  }

  const customer = await prisma.customer.create({
    data: { companyName: `P7 Customer ${stamp}`, status: "ACTIVE" },
  });
  const carrier = await prisma.carrier.create({
    data: { legalName: `P7 Carrier ${stamp}`, status: "ACTIVE", mcNumber: `MC${stamp}` },
  });
  const driver = await prisma.driver.create({
    data: {
      firstName: "P7",
      lastName: `Driver${stamp}`,
      phone: `555-${String(stamp).slice(-4)}`,
      carrierId: carrier.id,
      status: "AVAILABLE",
    },
  });

  const job = await prisma.job.create({
    data: {
      jobNumber: `P7-JOB-${stamp}`,
      customerId: customer.id,
      customerPoNumber: `PO-P7-${stamp}`,
      trucksRequired: 2,
      status: "DISPATCHED",
      totalRevenue: 8000,
      totalCost: 5000,
      grossProfit: 3000,
      marginPercent: 37.5,
      pickupDate: new Date(),
    },
  });

  const truck = await prisma.truckAssignment.create({
    data: {
      jobId: job.id,
      assignmentNumber: 1,
      displayId: "TRK-001",
      carrierId: carrier.id,
      driverId: driver.id,
      status: "IN_TRANSIT",
      carrierRate: 2500,
      totalWeightLbs: 42000,
      totalFootage: 1200,
    },
  });

  await prisma.truckAssignmentDocument.create({
    data: {
      truckAssignmentId: truck.id,
      documentType: "BOL",
      referenceNumber: `BOL-P7-${stamp}`,
      fileName: `bol-p7-${stamp}.pdf`,
      filePath: `local/p7/bol.pdf`,
      mimeType: "application/pdf",
      fileSizeBytes: 50,
      storageProvider: "local",
      isCurrent: true,
      status: "VALID",
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-P7-${stamp}`,
      customerId: customer.id,
      jobId: job.id,
      subtotal: 8000,
      invoiceAmount: 8000,
      amountPaid: 0,
      remainingBalance: 8000,
      status: "READY_TO_INVOICE",
    },
  });

  // Search coverage via DB queries (mirrors globalSearch filters)
  try {
    const byJob = await prisma.job.findFirst({
      where: { jobNumber: { contains: `P7-JOB-${stamp}`, mode: "insensitive" }, deletedAt: null },
    });
    const byPo = await prisma.job.findFirst({
      where: { customerPoNumber: { contains: `PO-P7-${stamp}`, mode: "insensitive" } },
    });
    const byDriver = await prisma.driver.findFirst({
      where: { lastName: { contains: `Driver${stamp}`, mode: "insensitive" } },
    });
    const byMc = await prisma.carrier.findFirst({
      where: { mcNumber: { contains: `MC${stamp}`, mode: "insensitive" } },
    });
    const byBol = await prisma.truckAssignmentDocument.findFirst({
      where: { referenceNumber: { contains: `BOL-P7-${stamp}`, mode: "insensitive" } },
    });
    const byInv = await prisma.invoice.findFirst({
      where: { invoiceNumber: { contains: `INV-P7-${stamp}`, mode: "insensitive" } },
    });
    const byFile = await prisma.truckAssignmentDocument.findFirst({
      where: { fileName: { contains: `bol-p7-${stamp}`, mode: "insensitive" } },
    });
    assert.ok(byJob && byPo && byDriver && byMc && byBol && byInv && byFile);
    pass("global search fields locate job, PO, driver, MC, BOL, invoice, filename");
  } catch (e) {
    fail("search", String(e));
  }

  // Dashboard-style counts
  try {
    const missingPods = await prisma.truckAssignment.findMany({
      where: { id: truck.id },
      include: { documents: { where: { isCurrent: true, deletedAt: null } } },
    });
    const missing = missingPods.filter((t) => {
      const types = new Set(t.documents.map((d) => d.documentType.toUpperCase()));
      return !types.has("POD");
    }).length;
    assert.equal(missing, 1);
    pass("missing POD count for dashboard metric");
  } catch (e) {
    fail("missing pods", String(e));
  }

  // Customer revenue totals
  try {
    const jobs = await prisma.job.findMany({
      where: { customerId: customer.id, deletedAt: null },
      select: { totalRevenue: true, grossProfit: true },
    });
    const revenue = sumDecimals(jobs.map((j) => j.totalRevenue.toString()));
    const profit = sumDecimals(jobs.map((j) => j.grossProfit.toString()));
    const margin = calculateProfitability({ revenue, cost: revenue.minus(profit) });
    assert.equal(revenue.toString(), "8000");
    assert.equal(profit.toString(), "3000");
    assert.ok(Number(margin.marginPercent) > 37);
    pass("customer revenue / profit totals");
  } catch (e) {
    fail("customer totals", String(e));
  }

  // Carrier cost totals
  try {
    const trucks = await prisma.truckAssignment.findMany({
      where: { carrierId: carrier.id, deletedAt: null },
      select: { carrierRate: true },
    });
    const cost = sumDecimals(trucks.map((t) => (t.carrierRate ?? 0).toString()));
    assert.equal(cost.toString(), "2500");
    pass("carrier cost totals");
  } catch (e) {
    fail("carrier totals", String(e));
  }

  // Pagination / take limits sanity
  try {
    const page = await prisma.job.findMany({
      where: { deletedAt: null },
      take: 25,
      skip: 0,
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    assert.ok(page.length <= 25);
    pass("report-style pagination take limit");
  } catch (e) {
    fail("pagination", String(e));
  }

  // Cleanup
  try {
    await prisma.invoice.delete({ where: { id: invoice.id } });
    await prisma.truckAssignmentDocument.deleteMany({ where: { truckAssignmentId: truck.id } });
    await prisma.truckAssignment.delete({ where: { id: truck.id } });
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.driver.delete({ where: { id: driver.id } });
    await prisma.carrier.delete({ where: { id: carrier.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    pass("cleanup");
  } catch (e) {
    fail("cleanup", String(e));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nPhase 7: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
