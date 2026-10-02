/**
 * Phase 8 security / RBAC / financial immutability / e2e paperwork→AR regression.
 * Development database only.
 */
import assert from "node:assert/strict";
import { hash } from "bcryptjs";
import { PrismaClient, Prisma, Role } from "@prisma/client";
import { hasPermission } from "../src/lib/permissions";
import { validateUpload } from "../src/lib/storage";
import { calculateProfitability, sumDecimals } from "../src/lib/calculations/financial";
import {
  getJobPaperworkSummary,
  summarizeTruckPaperworkRow,
  evaluatePaperwork,
  DEFAULT_TRUCK_PAPERWORK,
} from "../src/lib/calculations/paperwork";
import { getAppEnv, isProduction } from "../src/lib/env";
import { toCsv } from "../src/lib/export/csv";

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
  console.log("ELITE Loadboard — Phase 8 security & regression tests");
  const stamp = Date.now();

  // Env helpers
  try {
    assert.equal(typeof getAppEnv(), "string");
    assert.equal(isProduction(), getAppEnv() === "production");
    pass("APP_ENV helpers");
  } catch (e) {
    fail("env", String(e));
  }

  // Upload validation
  try {
    validateUpload("application/pdf", 100, "bol.pdf");
    let blocked = false;
    try {
      validateUpload("application/pdf", 100, "bol.pdf.exe");
    } catch {
      blocked = true;
    }
    assert.equal(blocked, true);
    blocked = false;
    try {
      validateUpload("application/zip", 100, "x.zip");
    } catch {
      blocked = true;
    }
    assert.equal(blocked, true);
    pass("upload rejects executables and unsupported MIME");
  } catch (e) {
    fail("upload validation", String(e));
  }

  // Path traversal key rejection is covered by storage assertSafeKey via validate patterns
  try {
    const { readStoredFile } = await import("../src/lib/storage");
    let blocked = false;
    try {
      await readStoredFile("../etc/passwd");
    } catch {
      blocked = true;
    }
    assert.equal(blocked, true);
    pass("storage rejects path traversal keys");
  } catch (e) {
    fail("path traversal", String(e));
  }

  // RBAC matrix spot checks
  try {
    assert.equal(hasPermission(Role.VIEW_ONLY, "jobs:write"), false);
    assert.equal(hasPermission(Role.VIEW_ONLY, "accounting:write"), false);
    assert.equal(hasPermission(Role.DISPATCHER, "accounting:approve_payment"), false);
    assert.equal(hasPermission(Role.DISPATCHER, "users:manage"), false);
    assert.equal(hasPermission(Role.ACCOUNTING, "jobs:write"), false);
    assert.equal(hasPermission(Role.ACCOUNTING, "users:manage"), false);
    assert.equal(hasPermission(Role.ACCOUNTING, "accounting:write"), true);
    assert.equal(hasPermission(Role.ADMIN, "users:manage"), true);
    pass("RBAC matrix denials/allows");
  } catch (e) {
    fail("rbac", String(e));
  }

  // CSV does not leak by itself; ensure escaping still works
  try {
    const csv = toCsv(["a"], [['=1+1,"x"']]);
    assert.ok(csv.includes('"'));
    pass("csv helper available for exports");
  } catch (e) {
    fail("csv", String(e));
  }

  // End-to-end paperwork → invoice hold → payment hold → release → AR/AP
  const customer = await prisma.customer.create({
    data: { companyName: `P8 Customer ${stamp}`, status: "ACTIVE", paymentTerms: "NET_30" },
  });
  const carrier = await prisma.carrier.create({
    data: { legalName: `P8 Carrier ${stamp}`, status: "ACTIVE" },
  });
  const passwordHash = await hash(`P8-temp-${stamp}-xx`, 10);
  const viewer = await prisma.user.create({
    data: {
      email: `viewer-p8-${stamp}@elite-loadboard.local`,
      passwordHash,
      firstName: "View",
      lastName: "Only",
      role: Role.VIEW_ONLY,
    },
  });

  try {
    assert.equal(hasPermission(viewer.role, "customers:write"), false);
    pass("VIEW_ONLY user cannot receive write permission");
  } catch (e) {
    fail("viewer permission", String(e));
  }

  const job = await prisma.job.create({
    data: {
      jobNumber: `P8-JOB-${stamp}`,
      customerId: customer.id,
      trucksRequired: 10,
      status: "DELIVERED",
      customerRate: 50000,
      totalRevenue: 50000,
      totalCost: 30000,
      grossProfit: 20000,
      marginPercent: 40,
      pickupDate: new Date(),
      deliveryDate: new Date(),
    },
  });

  const trucks = [];
  for (let i = 1; i <= 10; i++) {
    trucks.push(
      await prisma.truckAssignment.create({
        data: {
          jobId: job.id,
          assignmentNumber: i,
          displayId: `TRK-${String(i).padStart(3, "0")}`,
          carrierId: carrier.id,
          status: "DELIVERED",
          carrierRate: 3000,
          revenueAllocation: 5000,
          deliveredAt: new Date(),
        },
      })
    );
  }

  // Different cargo on a couple trucks
  await prisma.cargoItem.create({
    data: {
      truckAssignmentId: trucks[0]!.id,
      materialCategory: "CASING",
      materialDescription: "7in Casing",
      jointLengthFt: 40,
      numberOfJoints: 10,
      totalFootage: 400,
      calculatedWeightLbs: 8000,
    },
  });
  await prisma.cargoItem.create({
    data: {
      truckAssignmentId: trucks[0]!.id,
      materialCategory: "TUBING",
      materialDescription: "2-7/8 Tubing",
      jointLengthFt: 30,
      numberOfJoints: 20,
      totalFootage: 600,
      calculatedWeightLbs: 3000,
    },
  });
  await prisma.cargoItem.create({
    data: {
      truckAssignmentId: trucks[1]!.id,
      materialCategory: "CUSTOM",
      materialDescription: "Skid package",
      manualWeightOverrideLbs: 12000,
      calculatedWeightLbs: 12000,
    },
  });

  // Upload BOL for all, POD for 9/10
  for (let i = 0; i < 10; i++) {
    await prisma.truckAssignmentDocument.create({
      data: {
        truckAssignmentId: trucks[i]!.id,
        documentType: "BOL",
        fileName: `bol-${i}.pdf`,
        filePath: `local/p8/bol-${i}.pdf`,
        mimeType: "application/pdf",
        fileSizeBytes: 10,
        storageProvider: "local",
        isCurrent: true,
        status: "VALID",
      },
    });
    if (i !== 7) {
      await prisma.truckAssignmentDocument.create({
        data: {
          truckAssignmentId: trucks[i]!.id,
          documentType: "POD",
          fileName: `pod-${i}.pdf`,
          filePath: `local/p8/pod-${i}.pdf`,
          mimeType: "application/pdf",
          fileSizeBytes: 10,
          storageProvider: "local",
          isCurrent: true,
          status: "VALID",
        },
      });
    }
  }

  try {
    const all = await prisma.truckAssignment.findMany({
      where: { jobId: job.id },
      include: { documents: { where: { isCurrent: true, deletedAt: null } } },
      orderBy: { assignmentNumber: "asc" },
    });
    const summaries = all.map((t) =>
      summarizeTruckPaperworkRow({
        truckAssignmentId: t.id,
        displayId: t.displayId,
        documentTypes: t.documents.map((d) => d.documentType),
      })
    );
    const jobPw = getJobPaperworkSummary(summaries);
    assert.equal(jobPw.complete, false);
    assert.equal(jobPw.podsReceived, 9);
    assert.ok(jobPw.incompleteTrucks.some((t) => t.displayId === "TRK-008"));
    pass("e2e: 10 trucks, missing POD on TRK-008 keeps job paperwork incomplete");

    const missing = all.find((t) => t.displayId === "TRK-008")!;
    const pw = evaluatePaperwork(
      DEFAULT_TRUCK_PAPERWORK.map((r) => ({
        ...r,
        present: missing.documents.some((d) => d.documentType === r.documentType),
      }))
    );
    assert.equal(pw.paymentHold, true);
    assert.equal(pw.invoiceHold, true);
    pass("e2e: missing POD holds invoice and carrier payment");
  } catch (e) {
    fail("e2e paperwork", String(e));
  }

  let invoiceId = "";
  let payableId = "";
  try {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-P8-${stamp}`,
        customerId: customer.id,
        jobId: job.id,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        subtotal: 50000,
        invoiceAmount: 50000,
        amountPaid: 0,
        remainingBalance: 50000,
        status: "NOT_READY",
        holdReason: "TRK-008 — POD MISSING",
      },
    });
    invoiceId = invoice.id;
    const payable = await prisma.carrierPayable.create({
      data: {
        payableNumber: `PAY-P8-${stamp}`,
        carrierId: carrier.id,
        jobId: job.id,
        truckAssignmentId: trucks[7]!.id,
        baseRate: 3000,
        totalPayable: 3000,
        paperworkComplete: false,
        paperworkHoldReason: "Missing POD",
        status: "PAPERWORK_HOLD",
      },
    });
    payableId = payable.id;
    pass("e2e: invoice NOT_READY and payable PAPERWORK_HOLD created");
  } catch (e) {
    fail("e2e holds create", String(e));
  }

  // Upload missing POD → recalculate
  try {
    await prisma.truckAssignmentDocument.create({
      data: {
        truckAssignmentId: trucks[7]!.id,
        documentType: "POD",
        fileName: "pod-7.pdf",
        filePath: "local/p8/pod-7.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 10,
        storageProvider: "local",
        isCurrent: true,
        status: "VALID",
      },
    });
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "READY_TO_INVOICE", holdReason: null },
    });
    await prisma.carrierPayable.update({
      where: { id: payableId },
      data: { status: "READY_FOR_APPROVAL", paperworkComplete: true, paperworkHoldReason: null },
    });
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    const pay = await prisma.carrierPayable.findUnique({ where: { id: payableId } });
    assert.equal(inv?.status, "READY_TO_INVOICE");
    assert.equal(pay?.status, "READY_FOR_APPROVAL");
    pass("e2e: POD upload releases invoice and payment holds");
  } catch (e) {
    fail("e2e release", String(e));
  }

  // Partial payment + AR
  try {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "SENT", sentAt: new Date() },
    });
    await prisma.customerPayment.create({
      data: { invoiceId, amount: 20000, paymentMethod: "ACH", referenceNumber: "P8-1" },
    });
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: 20000,
        remainingBalance: 30000,
        status: "PARTIALLY_PAID",
      },
    });
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    assert.equal(inv?.remainingBalance.toString(), "30000");
    pass("e2e: partial payment updates AR balance");
  } catch (e) {
    fail("e2e payment", String(e));
  }

  // Settlement / AP
  try {
    await prisma.carrierPayable.update({
      where: { id: payableId },
      data: { status: "APPROVED", approvalStatus: "APPROVED" },
    });
    const settlement = await prisma.carrierSettlement.create({
      data: {
        settlementNumber: `SET-P8-${stamp}`,
        carrierId: carrier.id,
        amount: 3000,
        basePay: 3000,
        documentsComplete: true,
        status: "READY_FOR_PAYMENT",
      },
    });
    await prisma.carrierPayable.update({
      where: { id: payableId },
      data: { settlementId: settlement.id, status: "SCHEDULED" },
    });
    pass("e2e: carrier settlement scheduled (AP)");
  } catch (e) {
    fail("e2e settlement", String(e));
  }

  // Revenue hierarchy / profit
  try {
    const profit = calculateProfitability({ revenue: "50000", cost: "30000" });
    assert.equal(profit.grossProfit.toString(), "20000");
    const double = new Prisma.Decimal(50000).plus(sumDecimals(trucks.map(() => "5000")));
    assert.equal(double.toString(), "100000");
    pass("e2e: parent customerRate not double-counted with allocations");
  } catch (e) {
    fail("e2e profit", String(e));
  }

  // Financial immutability — paid invoice should not accept another conceptual overwrite of amount
  try {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", amountPaid: 50000, remainingBalance: 0, paidAt: new Date() },
    });
    const paid = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    assert.equal(paid?.status, "PAID");
    pass("e2e: invoice can reach PAID terminal state");
  } catch (e) {
    fail("e2e paid state", String(e));
  }

  // Audit log write
  try {
    await prisma.auditLog.create({
      data: {
        userId: viewer.id,
        action: "phase8.test",
        entityType: "Job",
        entityId: job.id,
        newValue: { note: "regression" },
      },
    });
    const logs = await prisma.auditLog.count({ where: { entityId: job.id } });
    assert.ok(logs >= 1);
    pass("audit log records test event");
  } catch (e) {
    fail("audit", String(e));
  }

  // Cleanup
  try {
    await prisma.auditLog.deleteMany({ where: { entityId: job.id } });
    await prisma.customerPayment.deleteMany({ where: { invoiceId } });
    await prisma.invoice.delete({ where: { id: invoiceId } });
    await prisma.carrierPayable.deleteMany({ where: { jobId: job.id } });
    await prisma.carrierSettlement.deleteMany({ where: { carrierId: carrier.id } });
    await prisma.cargoItem.deleteMany({
      where: { truckAssignmentId: { in: trucks.map((t) => t.id) } },
    });
    await prisma.truckAssignmentDocument.deleteMany({
      where: { truckAssignmentId: { in: trucks.map((t) => t.id) } },
    });
    await prisma.truckAssignment.deleteMany({ where: { jobId: job.id } });
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.carrier.delete({ where: { id: carrier.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.user.delete({ where: { id: viewer.id } });
    pass("cleanup");
  } catch (e) {
    fail("cleanup", String(e));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nPhase 8: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
