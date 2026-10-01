/**
 * Phase 5 integration tests — documents, paperwork independence, expirations.
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { storeFile, readStoredFile, validateUpload } from "../src/lib/storage";
import {
  summarizeTruckPaperworkRow,
  getJobPaperworkSummary,
  evaluatePaperwork,
} from "../src/lib/calculations/paperwork";
import { evaluateDocumentStatus } from "../src/lib/calculations/compliance";

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
  console.log("ELITE Loadboard — Phase 5 integration tests");

  // File validation
  try {
    validateUpload("application/pdf", 100);
    validateUpload("image/jpeg", 100);
    validateUpload("image/png", 100);
    let blocked = false;
    try {
      validateUpload("application/zip", 100);
    } catch {
      blocked = true;
    }
    assert.equal(blocked, true);
    pass("file type validation allows PDF/JPG/PNG only");
  } catch (e) {
    fail("file validation", String(e));
  }

  // Storage round-trip
  try {
    const stored = await storeFile({
      buffer: Buffer.from("%PDF-1.4 test"),
      originalName: "test-bol.pdf",
      mimeType: "application/pdf",
      folder: "test/phase5",
    });
    const buf = await readStoredFile(stored.filePath);
    assert.ok(buf.length > 0);
    assert.equal(stored.storageProvider, "local");
    pass("local storage upload/read");
  } catch (e) {
    fail("storage", String(e));
  }

  // Expiration engine
  try {
    const expired = evaluateDocumentStatus(new Date("2020-01-01"), 30);
    const soon = evaluateDocumentStatus(new Date(Date.now() + 5 * 86400000), 30);
    const valid = evaluateDocumentStatus(new Date(Date.now() + 90 * 86400000), 30);
    assert.equal(expired, "EXPIRED");
    assert.equal(soon, "EXPIRES_SOON");
    assert.equal(valid, "VALID");
    pass("expiration engine statuses");
  } catch (e) {
    fail("expiration", String(e));
  }

  const customer = await prisma.customer.create({
    data: { companyName: `P5 Customer ${Date.now()}`, status: "ACTIVE" },
  });
  const job = await prisma.job.create({
    data: {
      jobNumber: `P5-JOB-${Date.now()}`,
      customerId: customer.id,
      trucksRequired: 3,
      status: "SCHEDULED",
    },
  });
  const trucks = [];
  for (let i = 1; i <= 3; i++) {
    trucks.push(
      await prisma.truckAssignment.create({
        data: {
          jobId: job.id,
          assignmentNumber: i,
          displayId: `TRK-00${i}`,
          status: "ASSIGNED",
        },
      })
    );
  }

  // Upload independent docs: truck1 BOL+POD, truck2 BOL only, truck3 none
  await prisma.truckAssignmentDocument.create({
    data: {
      truckAssignmentId: trucks[0]!.id,
      documentType: "BOL",
      fileName: "t1-bol.pdf",
      filePath: "test/t1-bol.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 10,
      isCurrent: true,
    },
  });
  await prisma.truckAssignmentDocument.create({
    data: {
      truckAssignmentId: trucks[0]!.id,
      documentType: "POD",
      fileName: "t1-pod.pdf",
      filePath: "test/t1-pod.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 10,
      isCurrent: true,
    },
  });
  await prisma.truckAssignmentDocument.create({
    data: {
      truckAssignmentId: trucks[1]!.id,
      documentType: "BOL",
      fileName: "t2-bol.pdf",
      filePath: "test/t2-bol.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 10,
      isCurrent: true,
    },
  });

  const summaries = [];
  for (const t of trucks) {
    const docs = await prisma.truckAssignmentDocument.findMany({
      where: { truckAssignmentId: t.id, deletedAt: null, isCurrent: true },
    });
    summaries.push(
      summarizeTruckPaperworkRow({
        truckAssignmentId: t.id,
        displayId: t.displayId,
        documentTypes: docs.map((d) => d.documentType),
      })
    );
  }
  const jobSummary = getJobPaperworkSummary(summaries);

  try {
    assert.equal(summaries[0]!.complete, true);
    assert.equal(summaries[1]!.complete, false);
    assert.equal(summaries[1]!.statusLabel, "MISSING POD");
    assert.equal(summaries[2]!.complete, false);
    // Truck 2 missing POD must NOT be satisfied by truck 1 POD
    assert.equal(summaries[1]!.pod, false);
    assert.equal(jobSummary.bolsReceived, 2);
    assert.equal(jobSummary.podsReceived, 1);
    assert.equal(jobSummary.paperworkComplete, 1);
    assert.equal(jobSummary.complete, false);
    pass("truck document independence + job paperwork aggregation");
  } catch (e) {
    fail("paperwork independence", String(e));
  }

  // Multiple docs per truck + history archive
  const old = await prisma.truckAssignmentDocument.create({
    data: {
      truckAssignmentId: trucks[0]!.id,
      documentType: "POD",
      fileName: "old-pod.pdf",
      filePath: "test/old-pod.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 10,
      isCurrent: false,
      status: "ARCHIVED",
      archivedAt: new Date(),
    },
  });
  try {
    assert.ok(old.archivedAt);
    const currentPods = await prisma.truckAssignmentDocument.count({
      where: {
        truckAssignmentId: trucks[0]!.id,
        documentType: "POD",
        isCurrent: true,
        deletedAt: null,
      },
    });
    const archivedPods = await prisma.truckAssignmentDocument.count({
      where: {
        truckAssignmentId: trucks[0]!.id,
        documentType: "POD",
        isCurrent: false,
      },
    });
    assert.equal(currentPods, 1);
    assert.equal(archivedPods, 1);
    pass("document history preserved on replace/archive");
  } catch (e) {
    fail("document history", String(e));
  }

  // Payment hold evaluation
  try {
    const pw = evaluatePaperwork([
      { documentType: "BOL", label: "BOL", required: true, present: true, blocksPayment: false },
      { documentType: "POD", label: "POD", required: true, present: false, blocksPayment: true, blocksInvoice: true },
    ]);
    assert.equal(pw.complete, false);
    assert.equal(pw.paymentHold, true);
    assert.equal(pw.invoiceHold, true);
    assert.ok(pw.holdReasons.some((r) => r.includes("POD")));
    pass("missing POD creates payment + invoice hold");
  } catch (e) {
    fail("holds", String(e));
  }

  // Carrier expiration
  try {
    const carrier = await prisma.carrier.create({
      data: { legalName: `P5 Carrier ${Date.now()}`, status: "ACTIVE" },
    });
    await prisma.carrierDocument.create({
      data: {
        carrierId: carrier.id,
        documentType: "CERTIFICATE_OF_INSURANCE",
        fileName: "coi.pdf",
        filePath: "test/coi.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 10,
        expirationDate: new Date("2020-01-01"),
        isCurrent: true,
        status: "EXPIRED",
      },
    });
    const status = evaluateDocumentStatus(new Date("2020-01-01"), 30);
    assert.equal(status, "EXPIRED");
    await prisma.carrier.delete({ where: { id: carrier.id } }).catch(() => undefined);
    pass("carrier document expiration");
  } catch (e) {
    fail("carrier expiration", String(e));
  }

  await prisma.job.delete({ where: { id: job.id } }).catch(() => undefined);
  await prisma.customer.delete({ where: { id: customer.id } }).catch(() => undefined);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
