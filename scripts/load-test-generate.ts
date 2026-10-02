/**
 * DEVELOPMENT-ONLY load data generator for performance testing.
 * Does NOT commit generated datasets. Refuse to run in production.
 *
 * Example:
 *   LOAD_SCALE=small npx tsx scripts/load-test-generate.ts
 *   LOAD_SCALE=full  npx tsx scripts/load-test-generate.ts
 *
 * Scales:
 *   small — ~50 customers, 200 jobs (default)
 *   full  — ~500 customers, 500 carriers, 5k jobs, 25k trucks (slow, disk heavy)
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

function refuseProduction() {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || "").toLowerCase();
  if (env === "production" || env === "staging") {
    console.error("Refusing load-test generation in staging/production.");
    process.exit(1);
  }
}

async function main() {
  refuseProduction();
  const scale = (process.env.LOAD_SCALE || "small").toLowerCase();
  const full = scale === "full";
  const counts = full
    ? { customers: 500, carriers: 500, drivers: 1500, tractors: 500, trailers: 500, jobs: 5000, trucksPerJob: 5 }
    : { customers: 50, carriers: 50, drivers: 150, tractors: 50, trailers: 50, jobs: 200, trucksPerJob: 3 };

  console.log("Generating load-test data", counts);
  const stamp = Date.now();
  const customerIds: string[] = [];
  const carrierIds: string[] = [];

  for (let i = 0; i < counts.customers; i++) {
    const c = await prisma.customer.create({
      data: { companyName: `LoadTest Customer ${stamp}-${i}`, status: "ACTIVE" },
    });
    customerIds.push(c.id);
  }
  for (let i = 0; i < counts.carriers; i++) {
    const c = await prisma.carrier.create({
      data: {
        legalName: `LoadTest Carrier ${stamp}-${i}`,
        status: "ACTIVE",
        mcNumber: `LT${stamp}${i}`,
      },
    });
    carrierIds.push(c.id);
  }
  for (let i = 0; i < counts.drivers; i++) {
    await prisma.driver.create({
      data: {
        firstName: "LT",
        lastName: `Driver${i}`,
        phone: `555-${String(1000 + (i % 9000)).padStart(4, "0")}`,
        carrierId: carrierIds[i % carrierIds.length],
        status: "AVAILABLE",
      },
    });
  }
  for (let i = 0; i < counts.tractors; i++) {
    await prisma.tractor.create({
      data: {
        unitNumber: `LT-TR-${stamp}-${i}`,
        carrierId: carrierIds[i % carrierIds.length],
        status: "AVAILABLE",
      },
    });
  }
  for (let i = 0; i < counts.trailers; i++) {
    await prisma.trailer.create({
      data: {
        unitNumber: `LT-TL-${stamp}-${i}`,
        carrierId: carrierIds[i % carrierIds.length],
        trailerType: "FLATBED",
        status: "AVAILABLE",
      },
    });
  }

  let truckTotal = 0;
  for (let j = 0; j < counts.jobs; j++) {
    const job = await prisma.job.create({
      data: {
        jobNumber: `LT-JOB-${stamp}-${j}`,
        customerId: customerIds[j % customerIds.length]!,
        trucksRequired: counts.trucksPerJob,
        status: j % 5 === 0 ? "DISPATCHED" : "READY",
        pickupDate: new Date(Date.now() + (j % 14) * 86400000),
        totalRevenue: new Prisma.Decimal(1000 + (j % 50) * 100),
        rigName: j % 3 === 0 ? `Rig ${j % 20}` : null,
      },
    });
    for (let t = 1; t <= counts.trucksPerJob; t++) {
      await prisma.truckAssignment.create({
        data: {
          jobId: job.id,
          assignmentNumber: t,
          displayId: `TRK-${String(t).padStart(3, "0")}`,
          carrierId: carrierIds[(j + t) % carrierIds.length],
          status: t === 1 ? "DISPATCHED" : "ASSIGNED",
          totalWeightLbs: 40000 + (t * 100),
        },
      });
      truckTotal += 1;
    }
    if (j > 0 && j % 100 === 0) console.log(`  jobs ${j}/${counts.jobs}`);
  }

  console.log(`Done. customers=${customerIds.length} carriers=${carrierIds.length} trucks≈${truckTotal}`);
  console.log("Delete with: DELETE FROM \"Job\" WHERE \"jobNumber\" LIKE 'LT-JOB-%'; (cascade trucks)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
