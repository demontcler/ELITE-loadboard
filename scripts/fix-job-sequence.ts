import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  await p.companySettings.updateMany({ data: { nextJobSequence: 3 } });
  console.log("nextJobSequence set to 3");
  await p.$disconnect();
}

main();
