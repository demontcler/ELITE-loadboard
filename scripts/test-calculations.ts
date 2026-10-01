import assert from "node:assert/strict";
import { calculatePipeWeight } from "../src/lib/calculations/pipe";
import { summarizeTruckWeight } from "../src/lib/calculations/weight";
import { calculateProfitability } from "../src/lib/calculations/financial";
import {
  deriveJobStatus,
  summarizeTruckProgress,
  resolveLoadBoardColumn,
} from "../src/lib/calculations/job-status";
import { evaluatePaperwork } from "../src/lib/calculations/paperwork";
import { evaluateDocumentStatus } from "../src/lib/calculations/compliance";

function testPipeWeight() {
  const result = calculatePipeWeight({
    totalFootage: 1200,
    weightPerFoot: 36,
  });
  assert.equal(result.effectiveWeightLbs.toNumber(), 43200);
  assert.equal(result.totalFootage.toNumber(), 1200);

  const fromJoints = calculatePipeWeight({
    numberOfJoints: 40,
    jointLengthFt: 30,
    weightPerFoot: 21.6,
  });
  assert.equal(fromJoints.totalFootage.toNumber(), 1200);
  assert.equal(fromJoints.effectiveWeightLbs.toNumber(), 25920);
  assert.equal(fromJoints.derivedFootageFromJoints, true);

  const override = calculatePipeWeight({
    totalFootage: 1000,
    weightPerFoot: 36,
    manualWeightOverrideLbs: 40000,
  });
  assert.equal(override.usedOverride, true);
  assert.equal(override.effectiveWeightLbs.toNumber(), 40000);
}

function testTruckWeight() {
  const summary = summarizeTruckWeight(
    [
      { materialDescription: "5.5 casing", totalFootage: 800, weightPerFoot: 36 },
      { materialDescription: "2.875 tubing", totalFootage: 300, weightPerFoot: 12 },
    ],
    48000
  );
  assert.equal(summary.totalFootage.toNumber(), 1100);
  assert.equal(summary.totalWeightLbs.toNumber(), 32400);
  assert.equal(summary.exceedsThreshold, false);

  const heavy = summarizeTruckWeight(
    [{ totalFootage: 2000, weightPerFoot: 36 }],
    48000
  );
  assert.equal(heavy.exceedsThreshold, true);
}

function testFinancial() {
  const p = calculateProfitability({
    revenue: 2100,
    cost: 1550,
    additionalCost: 75,
  });
  assert.equal(p.grossProfit.toNumber(), 475);
  assert.ok(Math.abs(p.marginPercent.toNumber() - 22.6190476) < 0.01);
}

function testJobStatus() {
  const progress = summarizeTruckProgress(10, [
    "DISPATCHED",
    "DISPATCHED",
    "DISPATCHED",
    "DISPATCHED",
    "DISPATCHED",
    "DISPATCHED",
    "DELIVERED",
    "DELIVERED",
    "UNASSIGNED",
    "UNASSIGNED",
  ]);
  assert.equal(progress.needed, 2);
  assert.equal(progress.delivered, 2);

  const status = deriveJobStatus(10, [
    "DISPATCHED",
    "DISPATCHED",
    "DISPATCHED",
    "DISPATCHED",
    "DISPATCHED",
    "DISPATCHED",
    "DELIVERED",
    "DELIVERED",
    "UNASSIGNED",
    "UNASSIGNED",
  ]);
  assert.equal(status, "PARTIALLY_DISPATCHED");

  const partialDispatchStaffed = deriveJobStatus(3, [
    "DISPATCHED",
    "ASSIGNED",
    "ASSIGNED",
  ]);
  assert.equal(partialDispatchStaffed, "PARTIALLY_DISPATCHED");
}

function testLoadBoardColumn() {
  const today = new Date("2026-10-06T12:00:00");
  const future = resolveLoadBoardColumn(new Date("2026-10-10"), "SCHEDULED", today);
  assert.equal(future, "FUTURE");
  const todays = resolveLoadBoardColumn(new Date("2026-10-06T08:00:00"), "NEEDS_TRUCKS", today);
  assert.equal(todays, "TODAY");
  const dispatched = resolveLoadBoardColumn(new Date("2026-10-06"), "IN_TRANSIT", today);
  assert.equal(dispatched, "DISPATCHED");
}

function testPaperwork() {
  const result = evaluatePaperwork([
    { documentType: "BOL", label: "BOL", required: true, present: true, blocksPayment: false },
    { documentType: "POD", label: "POD", required: true, present: false, blocksPayment: true },
  ]);
  assert.equal(result.paymentHold, true);
  assert.deepEqual(result.holdReasons, ["Missing POD"]);
}

function testCompliance() {
  const expired = evaluateDocumentStatus(new Date("2020-01-01"), 30, new Date("2026-10-01"));
  assert.equal(expired, "EXPIRED");
  const soon = evaluateDocumentStatus(new Date("2026-10-15"), 30, new Date("2026-10-01"));
  assert.equal(soon, "EXPIRES_SOON");
}

testPipeWeight();
testTruckWeight();
testFinancial();
testJobStatus();
testLoadBoardColumn();
testPaperwork();
testCompliance();

console.log("All calculation tests passed.");
