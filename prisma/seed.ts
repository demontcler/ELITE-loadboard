import { hash } from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash("admin123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@elite-loadboard.local" },
    update: {
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: "admin@elite-loadboard.local",
      passwordHash,
      firstName: "System",
      lastName: "Admin",
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "dispatch@elite-loadboard.local" },
    update: {},
    create: {
      email: "dispatch@elite-loadboard.local",
      passwordHash: await hash("dispatch123!", 12),
      firstName: "Dana",
      lastName: "Dispatcher",
      role: Role.DISPATCHER,
    },
  });

  await prisma.user.upsert({
    where: { email: "accounting@elite-loadboard.local" },
    update: {},
    create: {
      email: "accounting@elite-loadboard.local",
      passwordHash: await hash("accounting123!", 12),
      firstName: "Alex",
      lastName: "Accounting",
      role: Role.ACCOUNTING,
    },
  });

  const existingSettings = await prisma.companySettings.findFirst();
  if (!existingSettings) {
    await prisma.companySettings.create({
      data: {
        companyName: "ELITE Logistics",
        defaultWeightWarningLbs: 48000,
        expiresSoonDays: 30,
        timezone: "America/Chicago",
      },
    });
  }

  const paperworkDefaults = [
    {
      entityType: "TRUCK_ASSIGNMENT",
      documentType: "RATE_CONFIRMATION",
      label: "Rate Confirmation",
      isRequired: true,
      blocksPayment: false,
    },
    {
      entityType: "TRUCK_ASSIGNMENT",
      documentType: "BOL",
      label: "BOL",
      isRequired: true,
      blocksPayment: false,
    },
    {
      entityType: "TRUCK_ASSIGNMENT",
      documentType: "POD",
      label: "POD",
      isRequired: true,
      blocksPayment: true,
    },
    {
      entityType: "TRUCK_ASSIGNMENT",
      documentType: "CARRIER_INVOICE",
      label: "Carrier Invoice",
      isRequired: true,
      blocksPayment: true,
    },
    {
      entityType: "CARRIER",
      documentType: "COI",
      label: "Certificate of Insurance",
      isRequired: true,
      blocksPayment: false,
    },
    {
      entityType: "CARRIER",
      documentType: "W9",
      label: "W-9",
      isRequired: true,
      blocksPayment: true,
    },
  ];

  for (const req of paperworkDefaults) {
    const existing = await prisma.complianceRequirement.findFirst({
      where: {
        entityType: req.entityType,
        documentType: req.documentType,
      },
    });
    if (!existing) {
      await prisma.complianceRequirement.create({ data: req });
    }
  }

  console.log("Seed complete.");
  console.log(`Admin user: ${admin.email} / admin123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
