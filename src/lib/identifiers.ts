import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type NumberKind = "job" | "invoice" | "settlement";
type Tx = Prisma.TransactionClient;

function formatJobNumber(
  prefix: string,
  year: number,
  seq: number,
  includeYear: boolean,
  padWidth: number
): string {
  const padded = String(seq).padStart(Math.max(1, padWidth), "0");
  return includeYear ? `${prefix}-${year}-${padded}` : `${prefix}-${padded}`;
}

async function nextDisplayId(tx: Tx, kind: NumberKind): Promise<string> {
  let settings = await tx.companySettings.findFirst();
  if (!settings) {
    settings = await tx.companySettings.create({ data: {} });
  }

  const year = new Date().getFullYear();

  if (kind === "job") {
    for (let attempt = 0; attempt < 50; attempt++) {
      // Atomic increment — concurrent transactions receive distinct sequences.
      const updated = await tx.companySettings.update({
        where: { id: settings.id },
        data: { nextJobSequence: { increment: 1 } },
      });
      const seq = updated.nextJobSequence - 1;
      const candidate = formatJobNumber(
        updated.jobNumberPrefix,
        year,
        seq,
        updated.jobNumberIncludeYear,
        updated.jobNumberPadWidth
      );
      const exists = await tx.job.findFirst({
        where: { jobNumber: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new Error("Unable to allocate a unique job number");
  }

  if (kind === "invoice") {
    const updated = await tx.companySettings.update({
      where: { id: settings.id },
      data: { nextInvoiceSequence: { increment: 1 } },
    });
    const seq = updated.nextInvoiceSequence - 1;
    return `${updated.invoiceNumberPrefix}-${year}-${String(seq).padStart(5, "0")}`;
  }

  const updated = await tx.companySettings.update({
    where: { id: settings.id },
    data: { nextSettlementSequence: { increment: 1 } },
  });
  const seq = updated.nextSettlementSequence - 1;
  return `${updated.settlementNumberPrefix}-${year}-${String(seq).padStart(5, "0")}`;
}

export async function generateDisplayId(kind: NumberKind): Promise<string> {
  return prisma.$transaction((tx) => nextDisplayId(tx, kind), {
    isolationLevel: "ReadCommitted",
    maxWait: 10_000,
    timeout: 15_000,
  });
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
