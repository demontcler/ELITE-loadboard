"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserPermission, requireSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import { storeFile, readStoredFile, getSecureDocumentUrl } from "@/lib/storage";
import { evaluateDocumentStatus } from "@/lib/calculations/compliance";
import {
  evaluatePaperwork,
  summarizeTruckPaperworkRow,
  getJobPaperworkSummary,
  DEFAULT_TRUCK_PAPERWORK,
  type JobPaperworkSummary,
  type TruckPaperworkSummary,
} from "@/lib/calculations/paperwork";
import type { DocumentOwnerType } from "@/lib/documents/types";
import { ActionError } from "@/lib/validators/form";

export type UploadDocumentInput = {
  ownerType: DocumentOwnerType;
  ownerId: string;
  documentType: string;
  referenceNumber?: string | null;
  notes?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  fileName: string;
  mimeType: string;
  /** Base64-encoded file contents (from client FormData conversion). */
  fileBase64: string;
  /** When true, archives any prior current document of the same type. */
  replaceCurrent?: boolean;
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getExpiresSoonDays(): Promise<number> {
  const s = await prisma.companySettings.findFirst();
  return s?.expiresSoonDays ?? 30;
}

function computeStatus(expirationDate: Date | null, expiresSoonDays: number): string {
  if (!expirationDate) return "VALID";
  return evaluateDocumentStatus(expirationDate, expiresSoonDays);
}

async function assertOwnerAccess(ownerType: DocumentOwnerType, ownerId: string) {
  switch (ownerType) {
    case "CUSTOMER": {
      const row = await prisma.customer.findFirst({ where: { id: ownerId, deletedAt: null } });
      if (!row) throw new ActionError("Customer not found");
      return row;
    }
    case "CARRIER": {
      const row = await prisma.carrier.findFirst({ where: { id: ownerId, deletedAt: null } });
      if (!row) throw new ActionError("Carrier not found");
      return row;
    }
    case "DRIVER": {
      const row = await prisma.driver.findFirst({ where: { id: ownerId, deletedAt: null } });
      if (!row) throw new ActionError("Driver not found");
      return row;
    }
    case "TRACTOR": {
      const row = await prisma.tractor.findFirst({ where: { id: ownerId, deletedAt: null } });
      if (!row) throw new ActionError("Tractor not found");
      return row;
    }
    case "TRAILER": {
      const row = await prisma.trailer.findFirst({ where: { id: ownerId, deletedAt: null } });
      if (!row) throw new ActionError("Trailer not found");
      return row;
    }
    case "JOB": {
      const row = await prisma.job.findFirst({ where: { id: ownerId, deletedAt: null } });
      if (!row) throw new ActionError("Job not found");
      return row;
    }
    case "TRUCK_ASSIGNMENT": {
      const row = await prisma.truckAssignment.findFirst({
        where: { id: ownerId, deletedAt: null },
        include: { job: { select: { id: true, jobNumber: true } } },
      });
      if (!row) throw new ActionError("Truck assignment not found");
      return row;
    }
    default:
      throw new ActionError("Unsupported document owner");
  }
}

function folderFor(ownerType: DocumentOwnerType, ownerId: string): string {
  return `${ownerType.toLowerCase()}/${ownerId}`;
}

export async function uploadDocument(input: UploadDocumentInput) {
  const session = await requireUserPermission("documents:write");
  await assertOwnerAccess(input.ownerType, input.ownerId);

  if (!input.documentType?.trim()) throw new ActionError("Document type is required");
  if (!input.fileBase64) throw new ActionError("File is required");

  const buffer = Buffer.from(input.fileBase64, "base64");
  const stored = await storeFile({
    buffer,
    originalName: input.fileName || "upload.bin",
    mimeType: input.mimeType,
    folder: folderFor(input.ownerType, input.ownerId),
  });

  const expiresSoonDays = await getExpiresSoonDays();
  const expirationDate = parseDate(input.expirationDate);
  const effectiveDate = parseDate(input.effectiveDate);
  const status = computeStatus(expirationDate, expiresSoonDays);
  const now = new Date();

  const common = {
    documentType: input.documentType.trim().toUpperCase(),
    referenceNumber: input.referenceNumber || null,
    fileName: stored.fileName,
    filePath: stored.filePath,
    storageProvider: stored.storageProvider,
    mimeType: stored.mimeType,
    fileSizeBytes: stored.fileSizeBytes,
    effectiveDate,
    expirationDate,
    isCurrent: true,
    status,
    notes: input.notes || null,
    uploadedById: session.user.id,
    uploadedAt: now,
  };

  let documentId = "";

  await prisma.$transaction(async (tx) => {
    if (input.replaceCurrent !== false) {
      // Archive prior current docs of same type for this owner
      await archivePriorCurrent(tx, input.ownerType, input.ownerId, common.documentType, now);
    }

    if (input.ownerType === "CUSTOMER") {
      const doc = await tx.customerDocument.create({
        data: { ...common, customerId: input.ownerId },
      });
      documentId = doc.id;
    } else if (input.ownerType === "CARRIER") {
      const doc = await tx.carrierDocument.create({
        data: { ...common, carrierId: input.ownerId, issueDate: effectiveDate },
      });
      documentId = doc.id;
    } else if (input.ownerType === "DRIVER") {
      const doc = await tx.driverDocument.create({
        data: { ...common, driverId: input.ownerId, issueDate: effectiveDate },
      });
      documentId = doc.id;
    } else if (input.ownerType === "TRACTOR") {
      const doc = await tx.equipmentDocument.create({
        data: { ...common, tractorId: input.ownerId, issueDate: effectiveDate },
      });
      documentId = doc.id;
    } else if (input.ownerType === "TRAILER") {
      const doc = await tx.equipmentDocument.create({
        data: { ...common, trailerId: input.ownerId, issueDate: effectiveDate },
      });
      documentId = doc.id;
    } else if (input.ownerType === "JOB") {
      const doc = await tx.jobDocument.create({
        data: { ...common, jobId: input.ownerId },
      });
      documentId = doc.id;
    } else if (input.ownerType === "TRUCK_ASSIGNMENT") {
      const doc = await tx.truckAssignmentDocument.create({
        data: { ...common, truckAssignmentId: input.ownerId },
      });
      documentId = doc.id;
    }
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "document.uploaded",
    entityType: input.ownerType,
    entityId: input.ownerId,
    newValue: {
      documentId,
      documentType: common.documentType,
      fileName: stored.fileName,
    },
  });

  revalidateOwner(input.ownerType, input.ownerId);
  if (input.ownerType === "TRUCK_ASSIGNMENT") {
    const truck = await prisma.truckAssignment.findFirst({
      where: { id: input.ownerId },
      select: { jobId: true },
    });
    if (truck) revalidatePath(`/jobs/${truck.jobId}`);
    // Recalculate AP/AR paperwork holds without circular static import
    try {
      const { recalculatePaperworkHolds } = await import("@/server/accounting");
      await recalculatePaperworkHolds(input.ownerId);
    } catch {
      // Non-fatal — document upload succeeded; holds can be refreshed manually
    }
  }
  return {
    id: documentId,
    href: getSecureDocumentUrl({ ownerType: input.ownerType, documentId }),
  };
}

async function archivePriorCurrent(
  tx: Prisma.TransactionClient,
  ownerType: DocumentOwnerType,
  ownerId: string,
  documentType: string,
  now: Date
) {
  const data = {
    isCurrent: false,
    status: "ARCHIVED",
    archivedAt: now,
  };
  if (ownerType === "CUSTOMER") {
    await tx.customerDocument.updateMany({
      where: { customerId: ownerId, documentType, isCurrent: true, deletedAt: null },
      data,
    });
  } else if (ownerType === "CARRIER") {
    await tx.carrierDocument.updateMany({
      where: { carrierId: ownerId, documentType, isCurrent: true, deletedAt: null },
      data,
    });
  } else if (ownerType === "DRIVER") {
    await tx.driverDocument.updateMany({
      where: { driverId: ownerId, documentType, isCurrent: true, deletedAt: null },
      data,
    });
  } else if (ownerType === "TRACTOR") {
    await tx.equipmentDocument.updateMany({
      where: { tractorId: ownerId, documentType, isCurrent: true, deletedAt: null },
      data,
    });
  } else if (ownerType === "TRAILER") {
    await tx.equipmentDocument.updateMany({
      where: { trailerId: ownerId, documentType, isCurrent: true, deletedAt: null },
      data,
    });
  } else if (ownerType === "JOB") {
    await tx.jobDocument.updateMany({
      where: { jobId: ownerId, documentType, isCurrent: true, deletedAt: null },
      data,
    });
  } else if (ownerType === "TRUCK_ASSIGNMENT") {
    await tx.truckAssignmentDocument.updateMany({
      where: { truckAssignmentId: ownerId, documentType, isCurrent: true, deletedAt: null },
      data,
    });
  }
}

function revalidateOwner(ownerType: DocumentOwnerType, ownerId: string) {
  revalidatePath("/documents");
  if (ownerType === "CUSTOMER") {
    revalidatePath(`/customers/${ownerId}`);
    revalidatePath("/customers");
  } else if (ownerType === "CARRIER") {
    revalidatePath(`/carriers/${ownerId}`);
  } else if (ownerType === "DRIVER") {
    revalidatePath(`/drivers/${ownerId}`);
  } else if (ownerType === "TRACTOR") {
    revalidatePath(`/equipment/tractors/${ownerId}`);
    revalidatePath("/equipment");
  } else if (ownerType === "TRAILER") {
    revalidatePath(`/equipment/trailers/${ownerId}`);
    revalidatePath("/equipment");
  } else if (ownerType === "JOB") {
    revalidatePath(`/jobs/${ownerId}`);
    revalidatePath("/load-board");
  } else if (ownerType === "TRUCK_ASSIGNMENT") {
    // job path refreshed by caller when known
    revalidatePath("/load-board");
    revalidatePath("/documents");
  }
}

export async function archiveDocument(ownerType: DocumentOwnerType, documentId: string) {
  const session = await requireUserPermission("documents:write");
  const now = new Date();
  let ownerId = "";

  if (ownerType === "CUSTOMER") {
    const doc = await prisma.customerDocument.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) throw new ActionError("Document not found");
    ownerId = doc.customerId;
    await prisma.customerDocument.update({
      where: { id: documentId },
      data: { isCurrent: false, status: "ARCHIVED", archivedAt: now },
    });
  } else if (ownerType === "CARRIER") {
    const doc = await prisma.carrierDocument.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) throw new ActionError("Document not found");
    ownerId = doc.carrierId;
    await prisma.carrierDocument.update({
      where: { id: documentId },
      data: { isCurrent: false, status: "ARCHIVED", archivedAt: now },
    });
  } else if (ownerType === "DRIVER") {
    const doc = await prisma.driverDocument.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) throw new ActionError("Document not found");
    ownerId = doc.driverId;
    await prisma.driverDocument.update({
      where: { id: documentId },
      data: { isCurrent: false, status: "ARCHIVED", archivedAt: now },
    });
  } else if (ownerType === "TRACTOR" || ownerType === "TRAILER") {
    const doc = await prisma.equipmentDocument.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) throw new ActionError("Document not found");
    ownerId = doc.tractorId || doc.trailerId || "";
    await prisma.equipmentDocument.update({
      where: { id: documentId },
      data: { isCurrent: false, status: "ARCHIVED", archivedAt: now },
    });
  } else if (ownerType === "JOB") {
    const doc = await prisma.jobDocument.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) throw new ActionError("Document not found");
    ownerId = doc.jobId;
    await prisma.jobDocument.update({
      where: { id: documentId },
      data: { isCurrent: false, status: "ARCHIVED", archivedAt: now },
    });
  } else if (ownerType === "TRUCK_ASSIGNMENT") {
    const doc = await prisma.truckAssignmentDocument.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (!doc) throw new ActionError("Document not found");
    ownerId = doc.truckAssignmentId;
    await prisma.truckAssignmentDocument.update({
      where: { id: documentId },
      data: { isCurrent: false, status: "ARCHIVED", archivedAt: now },
    });
  }

  await writeAuditLog({
    userId: session.user.id,
    action: "document.archived",
    entityType: ownerType,
    entityId: ownerId,
    newValue: { documentId },
  });
  revalidateOwner(ownerType, ownerId);
}

export async function getDocumentMeta(ownerType: DocumentOwnerType, documentId: string) {
  await requireUserPermission("documents:read");
  if (ownerType === "CUSTOMER") {
    return prisma.customerDocument.findFirst({ where: { id: documentId, deletedAt: null } });
  }
  if (ownerType === "CARRIER") {
    return prisma.carrierDocument.findFirst({ where: { id: documentId, deletedAt: null } });
  }
  if (ownerType === "DRIVER") {
    return prisma.driverDocument.findFirst({ where: { id: documentId, deletedAt: null } });
  }
  if (ownerType === "TRACTOR" || ownerType === "TRAILER") {
    return prisma.equipmentDocument.findFirst({ where: { id: documentId, deletedAt: null } });
  }
  if (ownerType === "JOB") {
    return prisma.jobDocument.findFirst({ where: { id: documentId, deletedAt: null } });
  }
  if (ownerType === "TRUCK_ASSIGNMENT") {
    return prisma.truckAssignmentDocument.findFirst({ where: { id: documentId, deletedAt: null } });
  }
  return null;
}

export async function getDocumentBuffer(ownerType: DocumentOwnerType, documentId: string) {
  await requireUserPermission("documents:read");
  const meta = await getDocumentMeta(ownerType, documentId);
  if (!meta) throw new ActionError("Document not found");
  const buffer = await readStoredFile(meta.filePath);
  return {
    buffer,
    fileName: meta.fileName,
    mimeType: meta.mimeType,
  };
}

export async function listOwnerDocuments(ownerType: DocumentOwnerType, ownerId: string) {
  await requireUserPermission("documents:read");
  await assertOwnerAccess(ownerType, ownerId);
  if (ownerType === "CUSTOMER") {
    return prisma.customerDocument.findMany({
      where: { customerId: ownerId, deletedAt: null },
      orderBy: [{ isCurrent: "desc" }, { uploadedAt: "desc" }],
    });
  }
  if (ownerType === "CARRIER") {
    return prisma.carrierDocument.findMany({
      where: { carrierId: ownerId, deletedAt: null },
      orderBy: [{ isCurrent: "desc" }, { uploadedAt: "desc" }],
    });
  }
  if (ownerType === "DRIVER") {
    return prisma.driverDocument.findMany({
      where: { driverId: ownerId, deletedAt: null },
      orderBy: [{ isCurrent: "desc" }, { uploadedAt: "desc" }],
    });
  }
  if (ownerType === "TRACTOR") {
    return prisma.equipmentDocument.findMany({
      where: { tractorId: ownerId, deletedAt: null },
      orderBy: [{ isCurrent: "desc" }, { uploadedAt: "desc" }],
    });
  }
  if (ownerType === "TRAILER") {
    return prisma.equipmentDocument.findMany({
      where: { trailerId: ownerId, deletedAt: null },
      orderBy: [{ isCurrent: "desc" }, { uploadedAt: "desc" }],
    });
  }
  if (ownerType === "JOB") {
    return prisma.jobDocument.findMany({
      where: { jobId: ownerId, deletedAt: null },
      orderBy: [{ isCurrent: "desc" }, { uploadedAt: "desc" }],
    });
  }
  return prisma.truckAssignmentDocument.findMany({
    where: { truckAssignmentId: ownerId, deletedAt: null },
    orderBy: [{ isCurrent: "desc" }, { uploadedAt: "desc" }],
  });
}

export async function listComplianceRequirements(entityType?: string) {
  await requireSession();
  return prisma.complianceRequirement.findMany({
    where: {
      isActive: true,
      ...(entityType ? { entityType } : {}),
    },
    orderBy: [{ entityType: "asc" }, { label: "asc" }],
  });
}

export async function getTruckPaperwork(truckAssignmentId: string): Promise<{
  summary: TruckPaperworkSummary;
  paperwork: ReturnType<typeof evaluatePaperwork>;
}> {
  await requireUserPermission("documents:read");
  const truck = await prisma.truckAssignment.findFirst({
    where: { id: truckAssignmentId, deletedAt: null },
    include: {
      documents: { where: { deletedAt: null, isCurrent: true } },
    },
  });
  if (!truck) throw new ActionError("Truck assignment not found");

  const reqs = await prisma.complianceRequirement.findMany({
    where: { entityType: "TRUCK_ASSIGNMENT", isActive: true },
  });
  const requirements: Array<{
    documentType: string;
    label: string;
    isRequired: boolean;
    blocksPayment: boolean;
    blocksInvoice: boolean;
  }> =
    reqs.length > 0
      ? reqs.map((r) => ({
          documentType: r.documentType,
          label: r.label,
          isRequired: r.isRequired,
          blocksPayment: r.blocksPayment,
          blocksInvoice: r.blocksInvoice,
        }))
      : DEFAULT_TRUCK_PAPERWORK.map((r) => ({
          documentType: r.documentType,
          label: r.label,
          isRequired: r.required,
          blocksPayment: r.blocksPayment,
          blocksInvoice: r.blocksInvoice ?? false,
        }));

  const presentTypes = truck.documents.map((d) => d.documentType.toUpperCase());
  const presentSet = new Set(presentTypes);
  const summary = summarizeTruckPaperworkRow({
    truckAssignmentId: truck.id,
    displayId: truck.displayId,
    documentTypes: presentTypes,
    requirements: requirements.map((r) => ({
      documentType: r.documentType,
      label: r.label,
      isRequired: r.isRequired,
    })),
  });
  const paperwork = evaluatePaperwork(
    requirements.map((r) => ({
      documentType: r.documentType,
      label: r.label,
      required: r.isRequired,
      present: presentSet.has(r.documentType.toUpperCase()),
      blocksPayment: r.blocksPayment,
      blocksInvoice: r.blocksInvoice,
    }))
  );
  return { summary, paperwork };
}

export async function getJobPaperwork(jobId: string): Promise<{
  trucks: TruckPaperworkSummary[];
  job: JobPaperworkSummary;
}> {
  await requireUserPermission("documents:read");
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: {
      trucks: {
        where: { deletedAt: null },
        orderBy: { assignmentNumber: "asc" },
        include: { documents: { where: { deletedAt: null, isCurrent: true } } },
      },
    },
  });
  if (!job) throw new ActionError("Job not found");

  const reqs = await prisma.complianceRequirement.findMany({
    where: { entityType: "TRUCK_ASSIGNMENT", isActive: true, isRequired: true },
  });

  const trucks = job.trucks.map((t) =>
    summarizeTruckPaperworkRow({
      truckAssignmentId: t.id,
      displayId: t.displayId,
      documentTypes: t.documents.map((d) => d.documentType),
      requirements: reqs.map((r) => ({
        documentType: r.documentType,
        label: r.label,
        isRequired: r.isRequired,
      })),
    })
  );
  return { trucks, job: getJobPaperworkSummary(trucks) };
}

export async function isTruckPaperworkCompleteAction(truckAssignmentId: string) {
  const { summary } = await getTruckPaperwork(truckAssignmentId);
  return summary.complete;
}

export async function getMissingRequiredDocumentsAction(truckAssignmentId: string) {
  const { summary } = await getTruckPaperwork(truckAssignmentId);
  return summary.missing;
}
