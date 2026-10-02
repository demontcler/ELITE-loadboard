/**
 * Safe production admin bootstrap.
 *
 * Usage:
 *   APP_ENV=production BOOTSTRAP_ADMIN_EMAIL=you@company.com BOOTSTRAP_ADMIN_PASSWORD='...' \
 *     npx tsx scripts/bootstrap-admin.ts
 */
import { hash } from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME || "System";
  const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME || "Admin";

  if (!email || !password) {
    console.error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      deletedAt: null,
      firstName,
      lastName,
    },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const existing = await prisma.companySettings.findFirst();
  if (!existing) {
    await prisma.companySettings.create({
      data: {
        companyName: process.env.COMPANY_NAME || "ELITE Logistics",
        defaultWeightWarningLbs: 48000,
        expiresSoonDays: 30,
        timezone: process.env.COMPANY_TIMEZONE || "America/Chicago",
      },
    });
  }

  console.log(`Admin ready: ${user.email} (${user.id})`);
  console.log("Password not printed. Rotate if this terminal is shared.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
