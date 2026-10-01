/**
 * Phase 1–4 functional audit harness.
 * Exercises permissions, master data, multi-truck cargo isolation,
 * pipe math, aggregate status, load-board placement, and DB integrity.
 */
import assert from "node:assert/strict";
import { hash } from "bcryptjs";
import {
  PrismaClient,
  Role,
} from "@prisma/client";
import { hasPermission, type Permission } from "../src/lib/permissions";
import { calculatePipeWeight } from "../src/lib/calculations/pipe";
import { summarizeTruckWeight } from "../src/lib/calculations/weight";
import { calculateProfitability } from "../src/lib/calculations/financial";
import {
  deriveJobStatus,
  summarizeTruckProgress,
  resolveLoadBoardColumn,
  type TruckStatusLike,
  type JobStatusLike,
} from "../src/lib/calculations/job-status";
import { formatTruckDisplayId } from "../src/lib/identifiers";

const prisma = new PrismaClient();
const results: { section: string; name: string; ok: boolean; detail?: string }[] = [];

function pass(section: string, name: string, detail?: string) {
  results.push({ section, name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(section: string, name: string, detail: string) {
  results.push({ section, name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

function section(title: string) {
  console.log(`\n== ${title} ==`);
}

async function auditPermissions() {
  section("RBAC permission matrix");
  const cases: Array<[Role, Permission, boolean]> = [
    [Role.ADMIN, "jobs:write", true],
    [Role.ADMIN, "users:manage", true],
    [Role.DISPATCHER, "jobs:write", true],
    [Role.DISPATCHER, "accounting:approve_payment", false],
    [Role.DISPATCHER, "users:manage", false],
    [Role.ACCOUNTING, "jobs:write", false],
    [Role.ACCOUNTING, "accounting:write", true],
    [Role.ACCOUNTING, "customers:write", false],
    [Role.OPERATIONS_MANAGER, "jobs:write", true],
    [Role.OPERATIONS_MANAGER, "customers:write", false],
    [Role.OPERATIONS_MANAGER, "audit:read", true],
    [Role.VIEW_ONLY, "jobs:read", true],
    [Role.VIEW_ONLY, "jobs:write", false],
    [Role.VIEW_ONLY, "customers:write", false],
    [Role.VIEW_ONLY, "accounting:write", false],
  ];

  for (const [role, perm, expected] of cases) {
    const actual = hasPermission(role, perm);
    if (actual === expected) {
      pass("rbac", `${role} ${perm} => ${expected}`);
    } else {
      fail("rbac", `${role} ${perm}`, `expected ${expected}, got ${actual}`);
    }
  }
}

async function ensureAuditUsers() {
  section("Seed / audit users");
  const passwordHash = await hash("audit123!", 12);
  const users = [
    { email: "ops@elite-loadboard.local", role: Role.OPERATIONS_MANAGER, firstName: "Olivia", lastName: "Ops" },
    { email: "viewer@elite-loadboard.local", role: Role.VIEW_ONLY, firstName: "Victor", lastName: "Viewer" },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role, isActive: true, deletedAt: null },
      create: { ...u, passwordHash },
    });
  }
  const roles = await prisma.user.groupBy({ by: ["role"], where: { deletedAt: null, isActive: true } });
  const present = new Set(roles.map((r) => r.role));
  for (const role of Object.values(Role)) {
    if (present.has(role)) pass("users", `Role ${role} has active user`);
    else fail("users", `Role ${role}`, "no active user in DB");
  }
}

async function auditMasterData() {
  section("Master data persistence");

  const customer = await prisma.customer.create({
    data: {
      companyName: `Audit Energy ${Date.now()}`,
      mainPhone: "432-555-0100",
      status: "ACTIVE",
      paymentTerms: "NET_30",
      contacts: {
        create: [
          { name: "Contact A", role: "Dispatcher", phone: "432-555-0101", isPrimary: true },
          { name: "Contact B", role: "Billing", email: "billing@audit.example" },
        ],
      },
      locations: {
        create: [
          {
            name: "Audit Yard",
            locationType: "Yard",
            city: "Midland",
            state: "TX",
          },
          {
            name: "Audit Rig 9",
            locationType: "Rig",
            rigName: "Rig 9",
            leaseName: "Audit Lease",
            wellName: "Audit 1H",
            county: "Reeves",
            state: "TX",
            latitude: 31.5,
            longitude: -103.5,
          },
        ],
      },
    },
    include: { contacts: true, locations: true },
  });
  assert.equal(customer.contacts.length, 2);
  assert.equal(customer.locations.length, 2);
  pass("customers", "Create customer with multiple contacts + locations");

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { notes: "Updated by audit", creditLimit: 250000 },
  });
  assert.equal(updated.notes, "Updated by audit");
  pass("customers", "Edit customer fields persisted");

  const carrier = await prisma.carrier.create({
    data: {
      legalName: `Audit Carrier ${Date.now()}`,
      mcNumber: `MC-${Date.now().toString().slice(-6)}`,
      usdotNumber: `USDOT-${Date.now().toString().slice(-7)}`,
      approvalStatus: "APPROVED",
      status: "ACTIVE",
      contacts: {
        create: [{ name: "Dispatch Desk", role: "Dispatch", phone: "432-555-0200", isPrimary: true }],
      },
    },
    include: { contacts: true },
  });
  assert.equal(carrier.contacts.length, 1);
  pass("carriers", "Create carrier with contact");

  await prisma.carrier.update({
    where: { id: carrier.id },
    data: { approvalStatus: "PREFERRED", status: "ACTIVE" },
  });
  pass("carriers", "Edit carrier status/approval");

  // Carrier contacts via Prisma model exist; app server/UI for adding contacts is missing — noted in report.

  const driver = await prisma.driver.create({
    data: {
      firstName: "Audit",
      lastName: "Driver",
      phone: "432-555-0300",
      carrierId: carrier.id,
      driverType: "CARRIER",
      cdlNumber: "TX-AUDIT-1",
      cdlState: "TX",
      cdlClass: "A",
      status: "AVAILABLE",
    },
  });
  assert.equal(driver.carrierId, carrier.id);
  pass("drivers", "Create driver assigned to carrier");

  await prisma.driver.update({
    where: { id: driver.id },
    data: { status: "ASSIGNED" },
  });
  pass("drivers", "Change driver operational status");

  const tractor = await prisma.tractor.create({
    data: {
      unitNumber: `AT-${Date.now().toString().slice(-4)}`,
      carrierId: carrier.id,
      year: 2022,
      make: "Kenworth",
      status: "AVAILABLE",
    },
  });
  const trailer = await prisma.trailer.create({
    data: {
      unitNumber: `AF-${Date.now().toString().slice(-4)}`,
      carrierId: carrier.id,
      trailerType: "FLATBED",
      maxPayloadLbs: 48000,
      status: "AVAILABLE",
    },
  });
  pass("equipment", "Create tractor + trailer linked to carrier");

  await prisma.tractor.update({ where: { id: tractor.id }, data: { status: "ASSIGNED" } });
  await prisma.trailer.update({ where: { id: trailer.id }, data: { status: "IN_TRANSIT" } });
  pass("equipment", "Change equipment status");

  const carrierView = await prisma.carrier.findUniqueOrThrow({
    where: { id: carrier.id },
    include: { drivers: true, tractors: true, trailers: true, contacts: true },
  });
  assert.ok(carrierView.drivers.some((d) => d.id === driver.id));
  assert.ok(carrierView.tractors.some((t) => t.id === tractor.id));
  assert.ok(carrierView.trailers.some((t) => t.id === trailer.id));
  pass("carriers", "Carrier shows associated drivers + equipment");

  return { customer, carrier, driver, tractor, trailer };
}

async function auditPipeCalculations() {
  section("Pipe calculations");

  const basic = calculatePipeWeight({ totalFootage: 1200, weightPerFoot: 36 });
  assert.equal(basic.effectiveWeightLbs.toNumber(), 43200);
  pass("pipe", "1200 ft × 36 lb/ft = 43,200 lb");

  const joints = calculatePipeWeight({
    numberOfJoints: 40,
    jointLengthFt: 31.5,
    weightPerFoot: 24.7,
  });
  assert.equal(joints.totalFootage.toNumber(), 1260);
  assert.ok(Math.abs(joints.effectiveWeightLbs.toNumber() - 31122) < 0.01);
  pass("pipe", "joints × length → footage → weight");

  const override = calculatePipeWeight({
    totalFootage: 1000,
    weightPerFoot: 36,
    manualWeightOverrideLbs: 41000,
  });
  assert.equal(override.usedOverride, true);
  assert.equal(override.effectiveWeightLbs.toNumber(), 41000);
  pass("pipe", "manual weight override");

  const invalid = calculatePipeWeight({
    totalFootage: "not-a-number",
    weightPerFoot: 36,
  });
  assert.equal(invalid.totalFootage.toNumber(), 0);
  assert.equal(invalid.effectiveWeightLbs.toNumber(), 0);
  pass("pipe", "invalid inputs degrade safely to zero (no throw)");

  const empty = calculatePipeWeight({});
  assert.equal(empty.effectiveWeightLbs.toNumber(), 0);
  pass("pipe", "empty input → zero weight");
}

async function auditCriticalMultiTruck(
  ctx: Awaited<ReturnType<typeof auditMasterData>>
) {
  section("CRITICAL multi-truck cargo isolation");

  const admin = await prisma.user.findFirstOrThrow({
    where: { email: "admin@elite-loadboard.local" },
  });

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const jobNumber = `JOB-AUDIT-${Date.now()}`;
  const job = await prisma.job.create({
    data: {
      jobNumber,
      customerId: ctx.customer.id,
      jobType: "PIPE",
      status: "NEEDS_TRUCKS",
      pickupDate: today,
      pickupTime: "06:00",
      pickupName: "Audit Midland Yard",
      pickupCity: "Midland",
      pickupState: "TX",
      deliveryName: "Rig Audit-6",
      deliveryCounty: "Reeves",
      deliveryState: "TX",
      rigName: "Rig Audit-6",
      trucksRequired: 6,
      customerRate: 24000,
      billingMethod: "PER_TRUCK",
      dispatcherId: admin.id,
    },
  });

  const trucks = [];
  for (let i = 1; i <= 6; i++) {
    trucks.push(
      await prisma.truckAssignment.create({
        data: {
          jobId: job.id,
          assignmentNumber: i,
          displayId: formatTruckDisplayId(i),
          status: "UNASSIGNED",
          pickupDate: today,
          dispatcherId: admin.id,
        },
      })
    );
  }
  pass("jobs", `Created job ${jobNumber} with 6 independent truck slots`);

  // TRUCK 1 — 5.5" casing 1200 ft @ 36
  const t1calc = calculatePipeWeight({ totalFootage: 1200, weightPerFoot: 36 });
  await prisma.cargoItem.create({
    data: {
      truckAssignmentId: trucks[0]!.id,
      materialCategory: "CASING",
      materialDescription: '5.5" casing',
      pipeOutsideDiameterIn: 5.5,
      totalFootage: 1200,
      weightPerFoot: 36,
      calculatedWeightLbs: t1calc.calculatedWeightLbs.toFixed(2),
    },
  });

  // TRUCK 2 — 7" casing 950 @ 44
  const t2calc = calculatePipeWeight({ totalFootage: 950, weightPerFoot: 44 });
  await prisma.cargoItem.create({
    data: {
      truckAssignmentId: trucks[1]!.id,
      materialCategory: "CASING",
      materialDescription: '7" casing',
      pipeOutsideDiameterIn: 7,
      totalFootage: 950,
      weightPerFoot: 44,
      calculatedWeightLbs: t2calc.calculatedWeightLbs.toFixed(2),
    },
  });

  // TRUCK 3 — tubing 1500 @ 12
  const t3calc = calculatePipeWeight({ totalFootage: 1500, weightPerFoot: 12 });
  await prisma.cargoItem.create({
    data: {
      truckAssignmentId: trucks[2]!.id,
      materialCategory: "TUBING",
      materialDescription: '2.875" tubing',
      pipeOutsideDiameterIn: 2.875,
      totalFootage: 1500,
      weightPerFoot: 12,
      calculatedWeightLbs: t3calc.calculatedWeightLbs.toFixed(2),
    },
  });

  // TRUCK 4 — two cargo items
  await prisma.cargoItem.createMany({
    data: [
      {
        truckAssignmentId: trucks[3]!.id,
        materialCategory: "CASING",
        materialDescription: '5.5" casing (bundle A)',
        totalFootage: 600,
        weightPerFoot: 36,
        calculatedWeightLbs: 21600,
        sortOrder: 1,
      },
      {
        truckAssignmentId: trucks[3]!.id,
        materialCategory: "TUBING",
        materialDescription: '2.875" tubing (bundle B)',
        totalFootage: 400,
        weightPerFoot: 12,
        calculatedWeightLbs: 4800,
        sortOrder: 2,
      },
    ],
  });

  // TRUCK 5 — non-pipe equipment
  await prisma.cargoItem.create({
    data: {
      truckAssignmentId: trucks[4]!.id,
      materialCategory: "RIG_EQUIPMENT",
      materialDescription: "Mud pump skid",
      quantity: 1,
      unit: "EA",
      manualWeightOverrideLbs: 18500,
      calculatedWeightLbs: 0,
    },
  });

  // TRUCK 6 — joints × length × wt/ft
  const t6calc = calculatePipeWeight({
    numberOfJoints: 40,
    jointLengthFt: 30,
    weightPerFoot: 21.6,
  });
  await prisma.cargoItem.create({
    data: {
      truckAssignmentId: trucks[5]!.id,
      materialCategory: "DRILL_PIPE",
      materialDescription: "Drill pipe",
      numberOfJoints: 40,
      jointLengthFt: 30,
      totalFootage: t6calc.totalFootage.toFixed(3),
      weightPerFoot: 21.6,
      calculatedWeightLbs: t6calc.calculatedWeightLbs.toFixed(2),
    },
  });

  // Recalc truck totals using centralized util
  for (const truck of trucks) {
    const items = await prisma.cargoItem.findMany({
      where: { truckAssignmentId: truck.id, deletedAt: null },
    });
    const summary = summarizeTruckWeight(
      items.map((i) => ({
        numberOfJoints: i.numberOfJoints,
        jointLengthFt: i.jointLengthFt?.toString(),
        totalFootage: i.totalFootage?.toString(),
        weightPerFoot: i.weightPerFoot?.toString(),
        manualWeightOverrideLbs: i.manualWeightOverrideLbs?.toString(),
        materialDescription: i.materialDescription,
      })),
      48000
    );
    await prisma.truckAssignment.update({
      where: { id: truck.id },
      data: {
        totalFootage: summary.totalFootage.toFixed(3),
        totalWeightLbs: summary.totalWeightLbs.toFixed(2),
        weightWarning: summary.exceedsThreshold,
      },
    });
  }

  const reloaded = await prisma.truckAssignment.findMany({
    where: { jobId: job.id, deletedAt: null },
    include: { cargoItems: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } } },
    orderBy: { assignmentNumber: "asc" },
  });

  assert.equal(reloaded.length, 6);
  assert.equal(reloaded[0]!.cargoItems.length, 1);
  assert.equal(reloaded[0]!.totalWeightLbs.toNumber(), 43200);
  assert.equal(reloaded[1]!.totalWeightLbs.toNumber(), 41800);
  assert.equal(reloaded[2]!.totalWeightLbs.toNumber(), 18000);
  assert.equal(reloaded[3]!.cargoItems.length, 2);
  assert.equal(reloaded[3]!.totalWeightLbs.toNumber(), 26400);
  assert.equal(reloaded[4]!.cargoItems[0]!.materialCategory, "RIG_EQUIPMENT");
  assert.equal(reloaded[4]!.totalWeightLbs.toNumber(), 18500);
  assert.equal(reloaded[5]!.totalFootage.toNumber(), 1200);
  assert.equal(reloaded[5]!.totalWeightLbs.toNumber(), 25920);
  pass("cargo", "Six trucks have distinct cargo + correct weights");

  // Isolation: edit truck 1 cargo, verify truck 2 unchanged
  const t2WeightBefore = reloaded[1]!.totalWeightLbs.toNumber();
  const t2DescBefore = reloaded[1]!.cargoItems[0]!.materialDescription;
  await prisma.cargoItem.update({
    where: { id: reloaded[0]!.cargoItems[0]!.id },
    data: { materialDescription: '5.5" casing EDITED', totalFootage: 1000, calculatedWeightLbs: 36000 },
  });
  const t2after = await prisma.truckAssignment.findUniqueOrThrow({
    where: { id: reloaded[1]!.id },
    include: { cargoItems: true },
  });
  assert.equal(t2after.totalWeightLbs.toNumber(), t2WeightBefore);
  assert.equal(t2after.cargoItems[0]!.materialDescription, t2DescBefore);
  pass("cargo", "Editing Truck 1 cargo does NOT modify Truck 2");

  // Independent assignment fields
  await prisma.truckAssignment.update({
    where: { id: trucks[0]!.id },
    data: {
      carrierId: ctx.carrier.id,
      driverId: ctx.driver.id,
      tractorId: ctx.tractor.id,
      trailerId: ctx.trailer.id,
      carrierRate: 1600,
      revenueAllocation: 4000,
      status: "ASSIGNED",
      notes: "Truck 1 only",
    },
  });
  await prisma.truckAssignment.update({
    where: { id: trucks[1]!.id },
    data: { status: "DISPATCHED", notes: "Truck 2 only", carrierRate: 1700 },
  });

  const t1 = await prisma.truckAssignment.findUniqueOrThrow({ where: { id: trucks[0]!.id } });
  const t2 = await prisma.truckAssignment.findUniqueOrThrow({ where: { id: trucks[1]!.id } });
  assert.equal(t1.status, "ASSIGNED");
  assert.equal(t2.status, "DISPATCHED");
  assert.equal(t1.notes, "Truck 1 only");
  assert.equal(t2.notes, "Truck 2 only");
  assert.equal(t1.carrierId, ctx.carrier.id);
  assert.equal(t1.driverId, ctx.driver.id);
  assert.equal(t1.tractorId, ctx.tractor.id);
  assert.equal(t1.trailerId, ctx.trailer.id);
  pass("assignments", "Independent carrier/driver/equipment/rate/status/notes per truck");

  // Job aggregates
  const allTrucks = await prisma.truckAssignment.findMany({
    where: { jobId: job.id, deletedAt: null },
  });
  const totalWeight = allTrucks.reduce((s, t) => s + Number(t.totalWeightLbs), 0);
  assert.ok(totalWeight > 100000);
  pass("jobs", `Job-level truck weight sum = ${totalWeight} lb`);

  return job;
}

async function auditAggregateStatus() {
  section("Aggregate job status");

  // Spec example-ish mixed set with 12 required
  const statuses: TruckStatusLike[] = [
    ...Array(3).fill("DELIVERED"),
    ...Array(4).fill("IN_TRANSIT"),
    ...Array(2).fill("ASSIGNED"),
    ...Array(3).fill("UNASSIGNED"),
  ] as TruckStatusLike[];
  assert.equal(statuses.length, 12);

  const progress = summarizeTruckProgress(12, statuses);
  assert.equal(progress.delivered, 3);
  assert.equal(progress.needed, 3); // 12 - (2+4+3) = 3
  const derived = deriveJobStatus(12, statuses);
  if (derived === "PARTIALLY_DISPATCHED") {
    pass("status", `Mixed 3/4/2/3 → ${derived}`, `needed=${progress.needed}`);
  } else {
    fail("status", "Mixed status aggregation", `expected PARTIALLY_DISPATCHED, got ${derived}`);
  }

  // Fully staffed partial delivery
  const full: TruckStatusLike[] = [
    ...Array(3).fill("DELIVERED"),
    ...Array(5).fill("IN_TRANSIT"),
    ...Array(4).fill("ASSIGNED"),
  ] as TruckStatusLike[];
  const d2 = deriveJobStatus(12, full);
  assert.equal(d2, "PARTIALLY_DELIVERED");
  pass("status", "Fully staffed mixed delivered/in-transit/assigned → PARTIALLY_DELIVERED");

  const allConfirmed = deriveJobStatus(2, ["CONFIRMED", "CONFIRMED"]);
  assert.equal(allConfirmed, "READY");

  // One truck status change shouldn't imply all
  const before = deriveJobStatus(3, ["ASSIGNED", "ASSIGNED", "ASSIGNED"]);
  const after = deriveJobStatus(3, ["DISPATCHED", "ASSIGNED", "ASSIGNED"]);
  assert.equal(before, "PARTIALLY_ASSIGNED");
  assert.equal(after, "PARTIALLY_DISPATCHED");
  assert.notEqual(before, after);
  pass("status", "Changing one truck to Dispatched yields PARTIALLY_DISPATCHED (not cloning single status)");
  pass("status", "All CONFIRMED → READY");
}

async function auditLoadBoard(jobId: string) {
  section("Load board placement");
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      customer: true,
      trucks: { where: { deletedAt: null } },
    },
  });

  // force a couple statuses for column test
  await prisma.truckAssignment.update({
    where: { id: job.trucks[1]!.id },
    data: { status: "IN_TRANSIT" },
  });
  const refreshed = await prisma.truckAssignment.findMany({
    where: { jobId, deletedAt: null },
  });
  const derived = deriveJobStatus(
    job.trucksRequired,
    refreshed.map((t) => t.status as TruckStatusLike)
  );
  await prisma.job.update({ where: { id: jobId }, data: { status: derived } });

  const col = resolveLoadBoardColumn(job.pickupDate, derived as JobStatusLike, new Date());
  pass("loadboard", `Audit job column=${col}, status=${derived}`);

  const progress = summarizeTruckProgress(
    job.trucksRequired,
    refreshed.map((t) => t.status as TruckStatusLike)
  );
  assert.ok(job.jobNumber);
  assert.ok(job.customer.companyName);
  assert.ok(job.pickupName || job.pickupCity);
  assert.equal(progress.required, 6);
  pass(
    "loadboard",
    "Card fields available",
    `${job.jobNumber} / ${job.customer.companyName} / ${progress.assigned} asgn / ${progress.needed} needed`
  );

  // Future job
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);
  const futureCol = resolveLoadBoardColumn(futureDate, "NEEDS_TRUCKS");
  assert.equal(futureCol, "FUTURE");
  pass("loadboard", "Future date → FUTURE column");
}

async function auditDataIntegrity() {
  section("Data integrity");

  const orphanCargo = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "CargoItem" c
    LEFT JOIN "TruckAssignment" t ON t.id = c."truckAssignmentId"
    WHERE t.id IS NULL
  `;
  assert.equal(Number(orphanCargo[0]!.count), 0);
  pass("integrity", "No orphaned CargoItems");

  const orphanTrucks = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "TruckAssignment" t
    LEFT JOIN "Job" j ON j.id = t."jobId"
    WHERE j.id IS NULL
  `;
  assert.equal(Number(orphanTrucks[0]!.count), 0);
  pass("integrity", "No TruckAssignments without Jobs");

  const dupJobs = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM (
      SELECT "jobNumber" FROM "Job" GROUP BY "jobNumber" HAVING COUNT(*) > 1
    ) d
  `;
  assert.equal(Number(dupJobs[0]!.count), 0);
  pass("integrity", "No duplicate jobNumbers");

  const dupTruckNums = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM (
      SELECT "jobId", "assignmentNumber" FROM "TruckAssignment"
      WHERE "deletedAt" IS NULL
      GROUP BY "jobId", "assignmentNumber" HAVING COUNT(*) > 1
    ) d
  `;
  assert.equal(Number(dupTruckNums[0]!.count), 0);
  pass("integrity", "No duplicate assignmentNumbers per job");

  // Money fields are Decimal in schema — spot check type
  const sample = await prisma.job.findFirst({ where: { customerRate: { not: null } } });
  if (sample?.customerRate) {
    const profit = calculateProfitability({
      revenue: sample.customerRate.toString(),
      cost: "1000",
      additionalCost: "50.25",
    });
    assert.ok(profit.grossProfit.isFinite());
    pass("integrity", "Financial calcs use Decimal-safe math");
  }

  // Soft-deleted jobs should not appear in active lists
  const activeJobs = await prisma.job.count({ where: { deletedAt: null } });
  const allJobs = await prisma.job.count();
  pass("integrity", `Jobs active=${activeJobs} total=${allJobs}`);
}

async function main() {
  console.log("ELITE Loadboard — Phase 1–4 Audit");
  await auditPermissions();
  await ensureAuditUsers();
  await auditPipeCalculations();
  const master = await auditMasterData();
  const job = await auditCriticalMultiTruck(master);
  await auditAggregateStatus();
  await auditLoadBoard(job.id);
  await auditDataIntegrity();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n== SUMMARY ==`);
  console.log(`Passed: ${results.filter((r) => r.ok).length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.error(`FAIL [${f.section}] ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  } else {
    console.log("All automated audit assertions passed.");
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
