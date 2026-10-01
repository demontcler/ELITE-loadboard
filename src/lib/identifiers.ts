import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type NumberKind = "job" | "invoice" | "settlement";
type Tx = Prisma.TransactionClient;

async function nextDisplayId(tx: Tx, kind: NumberKind): Promise<string> {
  let settings = await tx.companySettings.findFirst();
  if (!settings) {
    settings = await tx.companySettings.create({ data: {} });
  }

  const year = new Date().getFullYear();

  if (kind === "job") {
    // Skip any accidentally colliding human IDs (e.g. seed/manual inserts)
    let seq = settings.nextJobSequence;
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = `${settings.jobNumberPrefix}-${year}-${String(seq).padStart(6, "0")}`;
      const exists = await tx.job.findFirst({
        where: { jobNumber: candidate },
        select: { id: true },
      });
      if (!exists) {
        await tx.companySettings.update({
          where: { id: settings.id },
          data: { nextJobSequence: seq + 1 },
        });
        return candidate;
      }
      seq += 1;
    }
    throw new Error("Unable to allocate a unique job number");
  }

  if (kind === "invoice") {
    const seq = settings.nextInvoiceSequence;
    await tx.companySettings.update({
      where: { id: settings.id },
      data: { nextInvoiceSequence: seq + 1 },
    });
    return `${settings.invoiceNumberPrefix}-${year}-${String(seq).padStart(5, "0")}`;
  }

  const seq = settings.nextSettlementSequence;
  await tx.companySettings.update({
    where: { id: settings.id },
    data: { nextSettlementSequence: seq + 1 },
  });
  return `${settings.settlementNumberPrefix}-${year}-${String(seq).padStart(5, "0")}`;
}

/**
 * Generate human-readable operational IDs using CompanySettings sequences.
 * Prefer calling inside an existing write transaction via `generateDisplayIdInTransaction`.
 */
export async function generateDisplayId(kind: NumberKind): Promise<string> {
  return prisma.$transaction((tx) => nextDisplayId(tx, kind));
}

export async function generateDisplayIdInTransaction(
  tx: Tx,
  kind: NumberKind
): Promise<string> {
  return nextDisplayId(tx, kind);
}

export function formatTruckDisplayId(assignmentNumber: number): string {
  return `TRK-${String(assignmentNumber).padStart(3, "0")}`;
}
