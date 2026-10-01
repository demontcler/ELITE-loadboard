import { prisma } from "@/lib/db";

type NumberKind = "job" | "invoice" | "settlement";

/**
 * Generate human-readable operational IDs using CompanySettings sequences.
 * Defaults: JOB-2026-000001, INV-2026-00001, SET-2026-00001
 */
export async function generateDisplayId(kind: NumberKind): Promise<string> {
  return prisma.$transaction(async (tx) => {
    let settings = await tx.companySettings.findFirst();
    if (!settings) {
      settings = await tx.companySettings.create({ data: {} });
    }

    const year = new Date().getFullYear();

    if (kind === "job") {
      const seq = settings.nextJobSequence;
      await tx.companySettings.update({
        where: { id: settings.id },
        data: { nextJobSequence: seq + 1 },
      });
      return `${settings.jobNumberPrefix}-${year}-${String(seq).padStart(6, "0")}`;
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
  });
}

export function formatTruckDisplayId(assignmentNumber: number): string {
  return `TRK-${String(assignmentNumber).padStart(3, "0")}`;
}
