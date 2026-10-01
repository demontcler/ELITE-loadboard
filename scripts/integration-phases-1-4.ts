/**
 * Integration tests for Phases 1–4 operating model.
 * Covers multi-truck independence, cargo totals, aggregate status,
 * job number uniqueness, VIEW_ONLY permissions, and financial aggregation.
 */
import assert from "node:assert/strict";
import { PrismaClient, Role, type TruckAssignmentStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { hasPermission } from "../src/lib/permissions";
import { calculatePipeWeight } from "../src/lib/calculations/pipe";
import { summarizeTruckWeight } from "../src/lib/calculations/weight";
import { calculateProfitability, sumDecimals } from "../src/lib/calculations/financial";
import {
  deriveJobStatus,
  summarizeTruckProgress,
  type TruckStatusLike,
} from "../src/lib/calculations/job-status";
import { generateDisplayIdInTransaction, formatTruckDisplayId } from "../src/lib/identifiers";

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

async function ensureUsers() {
  const passwordHash = await hash("test123!", 10);
  for (const u of [
    { email: "admin@elite-loadboard.local", role: Role.ADMIN, firstName: "Ada", lastName: "Admin" },
    {
      email: "viewer@elite-loadboard.local",
      role: Role.VIEW_ONLY,
      firstName: "Victor",
      lastName: "Viewer",
    },
  ]) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, isActive: true, passwordHash },
      create: { ...u, passwordHash, isActive: true },
    });
  }
}

async function testMultiTruckIndependence() {
  console.log("\n== Multi-Truck Independence ==");
  const customer = await prisma.customer.create({
    data: { companyName: `IT Customer ${Date.now()}`, status: "ACTIVE" },
  });

  const job = await prisma.$transaction(async (tx) => {
    const jobNumber = await generateDisplayIdInTransaction(tx, "job");
    const created = await tx.job.create({
      data: {
        jobNumber,
        customerId: customer.id,
        trucksRequired: 3,
        status: "NEEDS_TRUCKS",
        jobType: "PIPE",
      },
    });
    for (let i = 1; i <= 3; i++) {
      await tx.truckAssignment.create({
        data: {
          jobId: created.id,
          assignmentNumber: i,
          displayId: formatTruckDisplayId(i),
          status: "UNASSIGNED",
        },
      });
    }
    return created;
  });

  const trucks = await prisma.truckAssignment.findMany({
    where: { jobId: job.id, deletedAt: null },
    orderBy: { assignmentNumber: "asc" },
  });
  assert.equal(trucks.length, 3);

  const cargoDefs = [
    { desc: "7in Casing", joints: 40, length: 40, wpf: 29 },
    { desc: "5.5in Tubing", joints: 60, length: 31, wpf: 17 },
    { desc: "Drill Pipe", joints: 20, length: 31, wpf: 19.5 },
  ];

  for (let i = 0; i < trucks.length; i++) {
    const def = cargoDefs[i]!;
    const calc = calculatePipeWeight({
      numberOfJoints: def.joints,
      jointLengthFt: def.length,
      weightPerFoot: def.wpf,
    });
    await prisma.cargoItem.create({
      data: {
        truckAssignmentId: trucks[i]!.id,
        materialCategory: "CASING",
        materialDescription: def.desc,
        numberOfJoints: def.joints,
        jointLengthFt: def.length,
        weightPerFoot: def.wpf,
        totalFootage: calc.totalFootage,
        calculatedWeightLbs: calc.calculatedWeightLbs,
      },
    });
  }

  // Modify truck 2 only
  await prisma.cargoItem.updateMany({
    where: { truckAssignmentId: trucks[1]!.id },
    data: { materialDescription: "5.5in Tubing MODIFIED", numberOfJoints: 80 },
  });

  const after = await prisma.truckAssignment.findMany({
    where: { jobId: job.id },
    include: { cargoItems: { where: { deletedAt: null } } },
    orderBy: { assignmentNumber: "asc" },
  });

  try {
    assert.equal(after[0]!.cargoItems[0]!.materialDescription, "7in Casing");
    assert.equal(after[1]!.cargoItems[0]!.materialDescription, "5.5in Tubing MODIFIED");
    assert.equal(after[2]!.cargoItems[0]!.materialDescription, "Drill Pipe");
    assert.equal(after[0]!.cargoItems[0]!.numberOfJoints, 40);
    assert.equal(after[1]!.cargoItems[0]!.numberOfJoints, 80);
    pass("modifying one truck does not affect others");
  } catch (e) {
    fail("modifying one truck does not affect others", String(e));
  }

  await prisma.job.delete({ where: { id: job.id } }).catch(() => undefined);
  await prisma.customer.delete({ where: { id: customer.id } }).catch(() => undefined);
}

async function testMultipleCargoItems() {
  console.log("\n== Multiple Cargo Items ==");
  const customer = await prisma.customer.create({
    data: { companyName: `IT Cargo ${Date.now()}`, status: "ACTIVE" },
  });
  const job = await prisma.job.create({
    data: {
      jobNumber: `IT-CARGO-${Date.now()}`,
      customerId: customer.id,
      trucksRequired: 1,
      status: "SCHEDULED",
    },
  });
  const truck = await prisma.truckAssignment.create({
    data: {
      jobId: job.id,
      assignmentNumber: 1,
      displayId: "TRK-001",
      status: "UNASSIGNED",
    },
  });

  const items = [
    { joints: 10, length: 40, wpf: 29 },
    { joints: 20, length: 31, wpf: 17 },
    { joints: 5, length: 40, wpf: 53 },
  ];
  for (const [idx, item] of items.entries()) {
    const calc = calculatePipeWeight({
      numberOfJoints: item.joints,
      jointLengthFt: item.length,
      weightPerFoot: item.wpf,
    });
    await prisma.cargoItem.create({
      data: {
        truckAssignmentId: truck.id,
        sortOrder: idx,
        materialCategory: "CASING",
        materialDescription: `Item ${idx + 1}`,
        numberOfJoints: item.joints,
        jointLengthFt: item.length,
        weightPerFoot: item.wpf,
        totalFootage: calc.totalFootage,
        calculatedWeightLbs: calc.calculatedWeightLbs,
      },
    });
  }

  const cargo = await prisma.cargoItem.findMany({ where: { truckAssignmentId: truck.id } });
  const summary = summarizeTruckWeight(
    cargo.map((c) => ({
      id: c.id,
      materialDescription: c.materialDescription,
      numberOfJoints: c.numberOfJoints,
      jointLengthFt: c.jointLengthFt?.toString(),
      totalFootage: c.totalFootage?.toString(),
      weightPerFoot: c.weightPerFoot?.toString(),
      manualWeightOverrideLbs: c.manualWeightOverrideLbs?.toString(),
    })),
    48000
  );

  try {
    assert.equal(cargo.length, 3);
    assert.ok(Number(summary.totalFootage) > 0);
    assert.ok(Number(summary.totalWeightLbs) > 0);
    const expectedFt = 10 * 40 + 20 * 31 + 5 * 40;
    assert.equal(Number(Number(summary.totalFootage).toFixed(3)), expectedFt);
    pass("one truck holds multiple cargo items with correct totals", `ft=${expectedFt}`);
  } catch (e) {
    fail("multiple cargo totals", String(e));
  }

  await prisma.job.delete({ where: { id: job.id } }).catch(() => undefined);
  await prisma.customer.delete({ where: { id: customer.id } }).catch(() => undefined);
}

async function testAggregateStatus() {
  console.log("\n== Aggregate Status ==");
  const statuses: TruckAssignmentStatus[] = [
    ...Array(3).fill("DELIVERED"),
    ...Array(4).fill("DISPATCHED"),
    ...Array(2).fill("ASSIGNED"),
    ...Array(3).fill("UNASSIGNED"),
  ] as TruckAssignmentStatus[];

  const progress = summarizeTruckProgress(12, statuses as TruckStatusLike[]);
  const derived = deriveJobStatus(12, statuses as TruckStatusLike[], "NEEDS_TRUCKS");

  try {
    assert.equal(progress.required, 12);
    assert.equal(progress.delivered, 3);
    assert.equal(progress.dispatched, 7); // active dispatched + delivered
    assert.equal(progress.assigned, 9); // staffed = assigned + dispatched + delivered
    assert.equal(progress.needed, 3);
    assert.equal(derived, "PARTIALLY_DISPATCHED");
    pass(
      "mixed statuses aggregate correctly",
      `delivered=${progress.delivered} dispatched=${progress.dispatched} needed=${progress.needed} job=${derived}`
    );
  } catch (e) {
    fail("aggregate status", String(e));
  }
}

async function testJobNumberGeneration() {
  console.log("\n== Job Number Generation ==");
  const customer = await prisma.customer.create({
    data: { companyName: `IT Num ${Date.now()}`, status: "ACTIVE" },
  });

  const numbers: string[] = [];
  for (let i = 0; i < 5; i++) {
    // Run small concurrent batches to validate uniqueness under contention
    const batch = await Promise.all(
      Array.from({ length: 3 }, () =>
        prisma.$transaction(
          async (tx) => {
            const jobNumber = await generateDisplayIdInTransaction(tx, "job");
            await tx.job.create({
              data: {
                jobNumber,
                customerId: customer.id,
                trucksRequired: 1,
                status: "DRAFT",
              },
            });
            return jobNumber;
          },
          { maxWait: 10_000, timeout: 15_000 }
        )
      )
    );
    numbers.push(...batch);
  }

  const unique = new Set(numbers);
  try {
    assert.equal(unique.size, numbers.length);
    pass("concurrent job creation produces unique numbers", numbers.join(", "));
  } catch (e) {
    fail("job number uniqueness", String(e));
  }

  await prisma.job.deleteMany({ where: { customerId: customer.id } });
  await prisma.customer.delete({ where: { id: customer.id } }).catch(() => undefined);
}

async function testPermissions() {
  console.log("\n== Permissions ==");
  try {
    assert.equal(hasPermission(Role.VIEW_ONLY, "jobs:read"), true);
    assert.equal(hasPermission(Role.VIEW_ONLY, "jobs:write"), false);
    assert.equal(hasPermission(Role.VIEW_ONLY, "customers:write"), false);
    assert.equal(hasPermission(Role.VIEW_ONLY, "settings:write"), false);
    assert.equal(hasPermission(Role.VIEW_ONLY, "drivers:write"), false);
    assert.equal(hasPermission(Role.ADMIN, "jobs:write"), true);
    pass("VIEW_ONLY cannot perform write operations");
  } catch (e) {
    fail("VIEW_ONLY permissions", String(e));
  }
}

async function testFinancialAggregation() {
  console.log("\n== Financial Aggregation ==");
  const customer = await prisma.customer.create({
    data: { companyName: `IT Fin ${Date.now()}`, status: "ACTIVE" },
  });

  // Case A: parent customerRate is authoritative — do not sum truck allocations again
  const jobA = await prisma.job.create({
    data: {
      jobNumber: `IT-FIN-A-${Date.now()}`,
      customerId: customer.id,
      trucksRequired: 2,
      customerRate: 10000,
      status: "SCHEDULED",
    },
  });
  await prisma.truckAssignment.createMany({
    data: [
      {
        jobId: jobA.id,
        assignmentNumber: 1,
        displayId: "TRK-001",
        revenueAllocation: 4000,
        totalCost: 1500,
        status: "ASSIGNED",
      },
      {
        jobId: jobA.id,
        assignmentNumber: 2,
        displayId: "TRK-002",
        revenueAllocation: 4000,
        totalCost: 1500,
        status: "ASSIGNED",
      },
    ],
  });
  const trucksA = await prisma.truckAssignment.findMany({ where: { jobId: jobA.id } });
  const allocationSum = sumDecimals(trucksA.map((t) => t.revenueAllocation?.toString()));
  const revenueA = jobA.customerRate
    ? Number(jobA.customerRate.toString())
    : Number(allocationSum.toString());
  const profitA = calculateProfitability({
    revenue: revenueA,
    cost: sumDecimals(trucksA.map((t) => t.totalCost.toString())),
  });

  try {
    assert.equal(revenueA, 10000);
    assert.notEqual(revenueA, Number(allocationSum.toString()));
    assert.equal(Number(profitA.grossProfit.toFixed(2)), 7000);
    pass("parent customerRate is authoritative (no double-count)", `rev=${revenueA}`);
  } catch (e) {
    fail("parent rate authoritative", String(e));
  }

  // Case B: no parent rate — derive from truck allocations
  const jobB = await prisma.job.create({
    data: {
      jobNumber: `IT-FIN-B-${Date.now()}`,
      customerId: customer.id,
      trucksRequired: 2,
      status: "SCHEDULED",
    },
  });
  await prisma.truckAssignment.createMany({
    data: [
      {
        jobId: jobB.id,
        assignmentNumber: 1,
        displayId: "TRK-001",
        revenueAllocation: 2500,
        totalCost: 1000,
        status: "ASSIGNED",
      },
      {
        jobId: jobB.id,
        assignmentNumber: 2,
        displayId: "TRK-002",
        revenueAllocation: 3500,
        totalCost: 1200,
        status: "ASSIGNED",
      },
    ],
  });
  const trucksB = await prisma.truckAssignment.findMany({ where: { jobId: jobB.id } });
  const revenueB = jobB.customerRate
    ? Number(jobB.customerRate.toString())
    : Number(sumDecimals(trucksB.map((t) => t.revenueAllocation?.toString())).toString());

  try {
    assert.equal(revenueB, 6000);
    pass("without parent rate, revenue derives from truck allocations", `rev=${revenueB}`);
  } catch (e) {
    fail("derived revenue", String(e));
  }

  await prisma.job.deleteMany({ where: { customerId: customer.id } });
  await prisma.customer.delete({ where: { id: customer.id } }).catch(() => undefined);
}

async function testSoftDeleteCascadesTrucks() {
  console.log("\n== Soft Delete ==");
  const customer = await prisma.customer.create({
    data: { companyName: `IT Soft ${Date.now()}`, status: "ACTIVE" },
  });
  const job = await prisma.job.create({
    data: {
      jobNumber: `IT-SOFT-${Date.now()}`,
      customerId: customer.id,
      trucksRequired: 2,
      status: "SCHEDULED",
    },
  });
  await prisma.truckAssignment.createMany({
    data: [
      { jobId: job.id, assignmentNumber: 1, displayId: "TRK-001", status: "UNASSIGNED" },
      { jobId: job.id, assignmentNumber: 2, displayId: "TRK-002", status: "ASSIGNED" },
    ],
  });

  const now = new Date();
  await prisma.$transaction([
    prisma.job.update({
      where: { id: job.id },
      data: { deletedAt: now, status: "CANCELLED", cancelledAt: now },
    }),
    prisma.truckAssignment.updateMany({
      where: { jobId: job.id, deletedAt: null },
      data: { deletedAt: now, status: "CANCELLED" },
    }),
  ]);

  const visibleTrucks = await prisma.truckAssignment.count({
    where: { jobId: job.id, deletedAt: null },
  });
  const archivedTrucks = await prisma.truckAssignment.count({
    where: { jobId: job.id, deletedAt: { not: null } },
  });

  try {
    assert.equal(visibleTrucks, 0);
    assert.equal(archivedTrucks, 2);
    pass("soft-deleted job leaves no operationally visible orphan trucks");
  } catch (e) {
    fail("soft delete orphans", String(e));
  }

  await prisma.job.delete({ where: { id: job.id } }).catch(() => undefined);
  await prisma.customer.delete({ where: { id: customer.id } }).catch(() => undefined);
}

async function main() {
  console.log("ELITE Loadboard — Phase 1–4 integration tests");
  await ensureUsers();
  await testMultiTruckIndependence();
  await testMultipleCargoItems();
  await testAggregateStatus();
  await testJobNumberGeneration();
  await testPermissions();
  await testFinancialAggregation();
  await testSoftDeleteCascadesTrucks();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
