import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const jobs = await p.job.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      jobNumber: true,
      trucksRequired: true,
      pickupName: true,
      createdAt: true,
      _count: { select: { trucks: true } },
    },
  });
  console.log(JSON.stringify(jobs, null, 2));
  await p.$disconnect();
}

main();
