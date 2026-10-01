import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const opsHash = await hash("ops123!", 12);
  await prisma.user.upsert({
    where: { email: "ops@elite-loadboard.local" },
    update: { passwordHash: opsHash, role: Role.OPERATIONS_MANAGER, isActive: true },
    create: {
      email: "ops@elite-loadboard.local",
      passwordHash: opsHash,
      firstName: "Olivia",
      lastName: "Ops",
      role: Role.OPERATIONS_MANAGER,
    },
  });

  const viewerHash = await hash("viewer123!", 12);
  await prisma.user.upsert({
    where: { email: "viewer@elite-loadboard.local" },
    update: { passwordHash: viewerHash, role: Role.VIEW_ONLY, isActive: true },
    create: {
      email: "viewer@elite-loadboard.local",
      passwordHash: viewerHash,
      firstName: "Victor",
      lastName: "Viewer",
      role: Role.VIEW_ONLY,
    },
  });

  console.log("Ops + viewer passwords reset.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
