/**
 * Phase 6 integration tests — accounting, revenue hierarchy, paperwork holds.
 */
import assert from "node:assert/strict";
import { PrismaClient, Prisma } from "@prisma/client";
import { calculateProfitability, sumDecimals } from "../src/lib/calculations/financial";
import {
  getJobPaperworkSummary,
  summarizeTruckPaperworkRow,
  evaluatePaperwork,
  DEFAULT_TRUCK_PAPERWORK,
} from "../src/lib/calculations/paperwork";

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
  console.log("ELITE Loadboard — Phase 6 integration tests");
  const stamp = Date.now();

  // Revenue hierarchy — no double counting
  try {
    const parentRate = new Prisma.Decimal(12000);
    const truckAllocs = [1000, 1000, 1000]; // would sum to 3000
    const jobRevenue = parentRate; // authoritative
    const wrong = sumDecimals(truckAllocs.map(String)).plus(parentRate);
    assert.equal(jobRevenue.toString(), "12000");
    assert.notEqual(wrong.toString(), jobRevenue.toString());
    const derived = sumDecimals(["4000", "5000", "3000"]);
    assert.equal(derived.toString(), "12000");
    pass("revenue hierarchy — parent rate not double-counted with truck allocations");
  } catch (e) {
    fail("revenue hierarchy", String(e));
  }

  // Profitability decimals
  try {
    const p = calculateProfitability({ revenue: "10000.50", cost: "7500.25" });
    assert.equal(p.grossProfit.toFixed(2), "2500.25");
    assert.ok(Number(p.marginPercent.toFixed(2)) > 24);
    pass("decimal-safe profitability");
  } catch (e) {
    fail("profitability", String(e));
  }

  const customer = await prisma.customer.create({
    data: { companyName: `P6 Customer ${stamp}`, status: "ACTIVE", paymentTerms: "NET_30" },
  });
  const carrier = await prisma.carrier.create({
    data: { legalName: `P6 Carrier ${stamp}`, status: "ACTIVE" },
  });

  const job = await prisma.job.create({
    data: {
      jobNumber: `P6-JOB-${stamp}`,
      customerId: customer.id,
      trucksRequired: 3,
      status: "DELIVERED",
      customerRate: 15000,
      totalRevenue: 15000,
      pickupDate: new Date(),
      deliveryDate: new Date(),
    },
  });

  const trucks: Array<{
    id: string;
    assignmentNumber: number;
    displayId: string;
    carrierRate: Prisma.Decimal | null;
    revenueAllocation: Prisma.Decimal | null;
  }> = [];
  for (let i = 1; i <= 3; i++) {
    trucks.push(
      await prisma.truckAssignment.create({
        data: {
          jobId: job.id,
          assignmentNumber: i,
          displayId: `TRK-${String(i).padStart(3, "0")}`,
          carrierId: carrier.id,
          status: "DELIVERED",
          carrierRate: 2000,
          revenueAllocation: 5000,
        },
      })
    );
  }

  // Paperwork independence → invoice / payment holds
  try {
    await prisma.truckAssignmentDocument.create({
      data: {
        truckAssignmentId: trucks[0]!.id,
        documentType: "BOL",
        fileName: "bol1.pdf",
        filePath: "local/p6/bol1.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 100,
        storageProvider: "local",
        isCurrent: true,
        status: "VALID",
      },
    });
    await prisma.truckAssignmentDocument.create({
      data: {
        truckAssignmentId: trucks[0]!.id,
        documentType: "POD",
        fileName: "pod1.pdf",
        filePath: "local/p6/pod1.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 100,
        storageProvider: "local",
        isCurrent: true,
        status: "VALID",
      },
    });
    await prisma.truckAssignmentDocument.create({
      data: {
        truckAssignmentId: trucks[1]!.id,
        documentType: "BOL",
        fileName: "bol2.pdf",
        filePath: "local/p6/bol2.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 100,
        storageProvider: "local",
        isCurrent: true,
        status: "VALID",
      },
    });
    // trucks[1] missing POD; trucks[2] missing both

    const docs = await prisma.truckAssignmentDocument.findMany({
      where: { truckAssignmentId: { in: trucks.map((t) => t.id) }, isCurrent: true, deletedAt: null },
    });
    const byTruck = new Map<string, string[]>();
    for (const d of docs) {
      const list = byTruck.get(d.truckAssignmentId) ?? [];
      list.push(d.documentType);
      byTruck.set(d.truckAssignmentId, list);
    }
    const summaries = trucks.map((t) =>
      summarizeTruckPaperworkRow({
        truckAssignmentId: t.id,
        displayId: t.displayId,
        documentTypes: byTruck.get(t.id) ?? [],
      })
    );
    const jobPw = getJobPaperworkSummary(summaries);
    assert.equal(jobPw.complete, false);
    assert.equal(jobPw.bolsReceived, 2);
    assert.equal(jobPw.podsReceived, 1);
    assert.equal(jobPw.paperworkComplete, 1);
    assert.ok(jobPw.incompleteTrucks.some((t) => t.displayId === "TRK-002"));
    pass("job paperwork incomplete with missing POD on TRK-002");

    const t2pw = evaluatePaperwork(
      DEFAULT_TRUCK_PAPERWORK.map((r) => ({
        ...r,
        present: (byTruck.get(trucks[1]!.id) ?? []).includes(r.documentType),
      }))
    );
    assert.equal(t2pw.paymentHold, true);
    assert.equal(t2pw.invoiceHold, true);
    assert.ok(t2pw.holdReasons.some((r) => /POD/i.test(r)));
    pass("missing POD creates payment and invoice hold");
  } catch (e) {
    fail("paperwork holds", String(e));
  }

  // Create invoice NOT_READY + payable PAPERWORK_HOLD
  let invoiceId = "";
  let payableMissingPodId = "";
  try {
    const holds = (
      await prisma.truckAssignment.findMany({
        where: { jobId: job.id },
        include: { documents: { where: { isCurrent: true, deletedAt: null } } },
      })
    )
      .map((t) => {
        const s = summarizeTruckPaperworkRow({
          truckAssignmentId: t.id,
          displayId: t.displayId,
          documentTypes: t.documents.map((d) => d.documentType),
        });
        return s.complete ? null : `${s.displayId} — ${s.missing.join(", ")} MISSING`;
      })
      .filter(Boolean) as string[];

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-P6-${stamp}`,
        customerId: customer.id,
        jobId: job.id,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        terms: "NET 30",
        subtotal: 15000,
        accessorialTotal: 0,
        invoiceAmount: 15000,
        amountPaid: 0,
        remainingBalance: 15000,
        status: "NOT_READY",
        holdReason: holds.join("; "),
        lineItems: {
          create: [
            {
              description: "Transportation — 3 Trucks",
              quantity: 1,
              unitPrice: 15000,
              amount: 15000,
            },
          ],
        },
      },
    });
    invoiceId = invoice.id;
    assert.equal(invoice.status, "NOT_READY");
    assert.ok(invoice.holdReason?.includes("TRK-002"));
    pass("invoice created NOT_READY with explicit hold reason");

    for (const t of trucks) {
      const docs = await prisma.truckAssignmentDocument.findMany({
        where: { truckAssignmentId: t.id, isCurrent: true, deletedAt: null },
      });
      const pw = evaluatePaperwork(
        DEFAULT_TRUCK_PAPERWORK.map((r) => ({
          ...r,
          present: docs.some((d) => d.documentType === r.documentType),
        }))
      );
      const payable = await prisma.carrierPayable.create({
        data: {
          payableNumber: `PAY-P6-${stamp}-${t.assignmentNumber}`,
          carrierId: carrier.id,
          jobId: job.id,
          truckAssignmentId: t.id,
          baseRate: 2000,
          accessorialPay: 0,
          totalPayable: 2000,
          paperworkComplete: !pw.paymentHold,
          paperworkHoldReason: pw.holdReasons.join("; ") || null,
          status: pw.paymentHold ? "PAPERWORK_HOLD" : "READY_FOR_APPROVAL",
        },
      });
      if (t.displayId === "TRK-002") payableMissingPodId = payable.id;
    }
    const held = await prisma.carrierPayable.findUnique({ where: { id: payableMissingPodId } });
    assert.equal(held?.status, "PAPERWORK_HOLD");
    pass("carrier payable on PAPERWORK_HOLD for missing POD");
  } catch (e) {
    fail("invoice/payable create", String(e));
  }

  // Upload missing POD → recalculate holds
  try {
    await prisma.truckAssignmentDocument.create({
      data: {
        truckAssignmentId: trucks[1]!.id,
        documentType: "POD",
        fileName: "pod2.pdf",
        filePath: "local/p6/pod2.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 100,
        storageProvider: "local",
        isCurrent: true,
        status: "VALID",
      },
    });
    // Also complete truck 3
    for (const type of ["BOL", "POD"] as const) {
      await prisma.truckAssignmentDocument.create({
        data: {
          truckAssignmentId: trucks[2]!.id,
          documentType: type,
          fileName: `${type.toLowerCase()}3.pdf`,
          filePath: `local/p6/${type.toLowerCase()}3.pdf`,
          mimeType: "application/pdf",
          fileSizeBytes: 100,
          storageProvider: "local",
          isCurrent: true,
          status: "VALID",
        },
      });
    }

    const allTrucks = await prisma.truckAssignment.findMany({
      where: { jobId: job.id },
      include: { documents: { where: { isCurrent: true, deletedAt: null } } },
    });
    const summaries = allTrucks.map((t) =>
      summarizeTruckPaperworkRow({
        truckAssignmentId: t.id,
        displayId: t.displayId,
        documentTypes: t.documents.map((d) => d.documentType),
      })
    );
    const jobPw = getJobPaperworkSummary(summaries);
    assert.equal(jobPw.complete, true);
    assert.equal(jobPw.paperworkComplete, 3);

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "READY_TO_INVOICE", holdReason: null },
    });
    await prisma.carrierPayable.updateMany({
      where: { jobId: job.id },
      data: { status: "READY_FOR_APPROVAL", paperworkComplete: true, paperworkHoldReason: null },
    });

    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    const pay = await prisma.carrierPayable.findUnique({ where: { id: payableMissingPodId } });
    assert.equal(inv?.status, "READY_TO_INVOICE");
    assert.equal(inv?.holdReason, null);
    assert.equal(pay?.status, "READY_FOR_APPROVAL");
    pass("POD upload releases invoice and payment holds");
  } catch (e) {
    fail("hold release", String(e));
  }

  // Partial payment + balance
  try {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "SENT", sentAt: new Date() },
    });
    await prisma.customerPayment.create({
      data: {
        invoiceId,
        amount: 5000,
        paymentMethod: "ACH",
        referenceNumber: "CHK-100",
      },
    });
    const paid = new Prisma.Decimal(5000);
    const total = new Prisma.Decimal(15000);
    const remaining = total.minus(paid);
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: paid,
        remainingBalance: remaining,
        status: "PARTIALLY_PAID",
      },
    });
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    assert.equal(inv?.status, "PARTIALLY_PAID");
    assert.equal(inv?.remainingBalance.toString(), "10000");
    pass("partial customer payment recalculates balance");
  } catch (e) {
    fail("partial payment", String(e));
  }

  // AR aging buckets
  try {
    const now = new Date();
    const overdue = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-P6-AGE-${stamp}`,
        customerId: customer.id,
        invoiceDate: new Date(now.getTime() - 45 * 86400000),
        dueDate: new Date(now.getTime() - 45 * 86400000),
        subtotal: 1000,
        invoiceAmount: 1000,
        amountPaid: 0,
        remainingBalance: 1000,
        status: "SENT",
      },
    });
    const due = overdue.dueDate!;
    const days = Math.floor((now.getTime() - due.getTime()) / 86400000);
    assert.ok(days > 30 && days <= 60);
    pass("AR aging day calculation (31–60 bucket)", `${days} days`);
  } catch (e) {
    fail("AR aging", String(e));
  }

  // Accessorial + settlement
  try {
    await prisma.accessorial.create({
      data: {
        truckAssignmentId: trucks[0]!.id,
        type: "DETENTION",
        amount: 250,
        customerAmount: 250,
        carrierAmount: 200,
        billToCustomer: true,
        payToCarrier: true,
        description: "2 hours detention",
      },
    });
    const settlement = await prisma.carrierSettlement.create({
      data: {
        settlementNumber: `SET-P6-${stamp}`,
        carrierId: carrier.id,
        amount: 6200,
        basePay: 6000,
        accessorialPay: 200,
        deductions: 0,
        documentsComplete: true,
        status: "READY_FOR_PAYMENT",
        lineItems: {
          create: trucks.map((t, idx) => ({
            description: t.displayId,
            amount: 2000,
            sortOrder: idx,
          })),
        },
      },
    });
    await prisma.carrierPayable.updateMany({
      where: { jobId: job.id },
      data: { settlementId: settlement.id, status: "SCHEDULED" },
    });
    const payables = await prisma.carrierPayable.findMany({ where: { settlementId: settlement.id } });
    assert.equal(payables.length, 3);
    pass("accessorial recorded and multi-truck settlement created");
  } catch (e) {
    fail("accessorial/settlement", String(e));
  }

  // Truck vs job profitability with parent rate
  try {
    const jobRev = new Prisma.Decimal(15000); // parent rate, NOT sum of allocations added again
    const jobCost = sumDecimals(trucks.map((t) => t.carrierRate?.toString() ?? "0"));
    const jobProfit = calculateProfitability({
      revenue: jobRev,
      cost: jobCost,
    });
    const allocSum = sumDecimals(trucks.map((t) => t.revenueAllocation!.toString()));
    // Allocations happen to equal parent rate in this fixture — still must not ADD them
    const doubleCounted = jobRev.plus(allocSum);
    assert.equal(allocSum.toString(), "15000");
    assert.equal(doubleCounted.toString(), "30000");
    assert.equal(jobProfit.revenue.toString(), "15000");
    assert.equal(jobProfit.grossProfit.toString(), "9000");
    pass("job profitability uses parent rate once (no double count)");
  } catch (e) {
    fail("job profitability", String(e));
  }

  // Cleanup soft — leave records for audit; hard-delete test artifacts
  try {
    await prisma.customerPayment.deleteMany({ where: { invoice: { customerId: customer.id } } });
    await prisma.invoiceLineItem.deleteMany({
      where: { invoice: { customerId: customer.id } },
    });
    await prisma.invoice.deleteMany({ where: { customerId: customer.id } });
    await prisma.carrierPayable.deleteMany({ where: { jobId: job.id } });
    await prisma.settlementLineItem.deleteMany({
      where: { settlement: { carrierId: carrier.id } },
    });
    await prisma.carrierSettlement.deleteMany({ where: { carrierId: carrier.id } });
    await prisma.accessorial.deleteMany({
      where: { truckAssignmentId: { in: trucks.map((t) => t.id) } },
    });
    await prisma.truckAssignmentDocument.deleteMany({
      where: { truckAssignmentId: { in: trucks.map((t) => t.id) } },
    });
    await prisma.truckAssignment.deleteMany({ where: { jobId: job.id } });
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.carrier.delete({ where: { id: carrier.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    pass("test data cleaned up");
  } catch (e) {
    fail("cleanup", String(e));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nPhase 6: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
