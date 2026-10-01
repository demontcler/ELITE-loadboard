"use server";

import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { evaluateDocumentStatus } from "@/lib/calculations/compliance";
import { buildComplianceStatus, type ComplianceAlert } from "@/lib/calculations/paperwork";

async function expiresSoonDays(): Promise<number> {
  const s = await prisma.companySettings.findFirst();
  return s?.expiresSoonDays ?? 30;
}

export async function listComplianceCenter(filters?: {
  entityType?: string;
  documentType?: string;
  status?: string;
  q?: string;
}) {
  await requireUserPermission("documents:read");
  const days = await expiresSoonDays();
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + days);

  type Row = {
    id: string;
    ownerType: string;
    ownerId: string;
    ownerLabel: string;
    documentType: string;
    fileName: string;
    status: string;
    expirationDate: Date | null;
    uploadedAt: Date;
    isCurrent: boolean;
    href: string;
  };

  const rows: Row[] = [];

  const includeEntity = (t: string) => !filters?.entityType || filters.entityType === t;
  const typeFilter = filters?.documentType
    ? { documentType: { equals: filters.documentType, mode: "insensitive" as const } }
    : {};

  if (includeEntity("CUSTOMER") || includeEntity("CUSTOMER")) {
    const docs = await prisma.customerDocument.findMany({
      where: { deletedAt: null, isCurrent: true, ...typeFilter },
      include: { customer: { select: { id: true, companyName: true } } },
      orderBy: { uploadedAt: "desc" },
      take: 200,
    });
    for (const d of docs) {
      const status = evaluateDocumentStatus(d.expirationDate, days, now);
      rows.push({
        id: d.id,
        ownerType: "CUSTOMER",
        ownerId: d.customerId,
        ownerLabel: d.customer.companyName,
        documentType: d.documentType,
        fileName: d.fileName,
        status: d.status === "ARCHIVED" ? "ARCHIVED" : status,
        expirationDate: d.expirationDate,
        uploadedAt: d.uploadedAt,
        isCurrent: d.isCurrent,
        href: `/customers/${d.customerId}`,
      });
    }
  }

  if (includeEntity("CARRIER")) {
    const docs = await prisma.carrierDocument.findMany({
      where: { deletedAt: null, isCurrent: true, ...typeFilter },
      include: { carrier: { select: { id: true, legalName: true } } },
      orderBy: { uploadedAt: "desc" },
      take: 200,
    });
    for (const d of docs) {
      const status = evaluateDocumentStatus(d.expirationDate, days, now);
      rows.push({
        id: d.id,
        ownerType: "CARRIER",
        ownerId: d.carrierId,
        ownerLabel: d.carrier.legalName,
        documentType: d.documentType,
        fileName: d.fileName,
        status: d.status === "ARCHIVED" ? "ARCHIVED" : status,
        expirationDate: d.expirationDate,
        uploadedAt: d.uploadedAt,
        isCurrent: d.isCurrent,
        href: `/carriers/${d.carrierId}`,
      });
    }
  }

  if (includeEntity("DRIVER")) {
    const docs = await prisma.driverDocument.findMany({
      where: { deletedAt: null, isCurrent: true, ...typeFilter },
      include: { driver: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { uploadedAt: "desc" },
      take: 200,
    });
    for (const d of docs) {
      const status = evaluateDocumentStatus(d.expirationDate, days, now);
      rows.push({
        id: d.id,
        ownerType: "DRIVER",
        ownerId: d.driverId,
        ownerLabel: `${d.driver.firstName} ${d.driver.lastName}`,
        documentType: d.documentType,
        fileName: d.fileName,
        status: d.status === "ARCHIVED" ? "ARCHIVED" : status,
        expirationDate: d.expirationDate,
        uploadedAt: d.uploadedAt,
        isCurrent: d.isCurrent,
        href: `/drivers/${d.driverId}`,
      });
    }
  }

  if (includeEntity("EQUIPMENT") || includeEntity("TRACTOR") || includeEntity("TRAILER")) {
    const docs = await prisma.equipmentDocument.findMany({
      where: { deletedAt: null, isCurrent: true, ...typeFilter },
      include: {
        tractor: { select: { id: true, unitNumber: true } },
        trailer: { select: { id: true, unitNumber: true } },
      },
      orderBy: { uploadedAt: "desc" },
      take: 200,
    });
    for (const d of docs) {
      const status = evaluateDocumentStatus(d.expirationDate, days, now);
      const isTractor = !!d.tractorId;
      rows.push({
        id: d.id,
        ownerType: isTractor ? "TRACTOR" : "TRAILER",
        ownerId: d.tractorId || d.trailerId || "",
        ownerLabel: isTractor
          ? `Tractor ${d.tractor?.unitNumber}`
          : `Trailer ${d.trailer?.unitNumber}`,
        documentType: d.documentType,
        fileName: d.fileName,
        status: d.status === "ARCHIVED" ? "ARCHIVED" : status,
        expirationDate: d.expirationDate,
        uploadedAt: d.uploadedAt,
        isCurrent: d.isCurrent,
        href: isTractor
          ? `/equipment/tractors/${d.tractorId}`
          : `/equipment/trailers/${d.trailerId}`,
      });
    }
  }

  if (includeEntity("TRUCK_ASSIGNMENT")) {
    const docs = await prisma.truckAssignmentDocument.findMany({
      where: { deletedAt: null, isCurrent: true, ...typeFilter },
      include: {
        truckAssignment: {
          select: {
            id: true,
            displayId: true,
            job: { select: { id: true, jobNumber: true } },
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
      take: 300,
    });
    for (const d of docs) {
      rows.push({
        id: d.id,
        ownerType: "TRUCK_ASSIGNMENT",
        ownerId: d.truckAssignmentId,
        ownerLabel: `${d.truckAssignment.job.jobNumber} / ${d.truckAssignment.displayId}`,
        documentType: d.documentType,
        fileName: d.fileName,
        status: d.status,
        expirationDate: d.expirationDate,
        uploadedAt: d.uploadedAt,
        isCurrent: d.isCurrent,
        href: `/jobs/${d.truckAssignment.job.id}`,
      });
    }
  }

  // Missing required carrier/driver docs
  const missingAlerts: ComplianceAlert[] = [];
  if (!filters?.status || filters.status === "MISSING") {
    const carrierReqs = await prisma.complianceRequirement.findMany({
      where: { entityType: "CARRIER", isActive: true, isRequired: true },
    });
    if (carrierReqs.length && includeEntity("CARRIER")) {
      const carriers = await prisma.carrier.findMany({
        where: { deletedAt: null, status: "ACTIVE" },
        include: { documents: { where: { deletedAt: null, isCurrent: true } } },
        take: 100,
      });
      for (const c of carriers) {
        const have = new Set(c.documents.map((d) => d.documentType.toUpperCase()));
        for (const req of carrierReqs) {
          if (!have.has(req.documentType.toUpperCase())) {
            missingAlerts.push({
              entityType: "CARRIER",
              entityId: c.id,
              entityLabel: c.legalName,
              documentType: req.documentType,
              status: "MISSING",
              message: `Missing ${req.label}`,
            });
          }
        }
      }
    }
  }

  let filtered = rows;
  if (filters?.status) {
    filtered = filtered.filter((r) => r.status === filters.status);
  }
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.ownerLabel.toLowerCase().includes(q) ||
        r.documentType.toLowerCase().includes(q) ||
        r.fileName.toLowerCase().includes(q)
    );
  }

  const counts = {
    expired: rows.filter((r) => r.status === "EXPIRED").length,
    expiringSoon: rows.filter((r) => r.status === "EXPIRES_SOON").length,
    missing: missingAlerts.length,
    valid: rows.filter((r) => r.status === "VALID").length,
  };

  return { rows: filtered, missingAlerts, counts, expiresSoonDays: days };
}

export async function getDispatchComplianceWarnings(params: {
  carrierId?: string | null;
  driverId?: string | null;
  tractorId?: string | null;
  trailerId?: string | null;
}): Promise<ComplianceAlert[]> {
  await requireUserPermission("jobs:read");
  const days = await expiresSoonDays();
  const alerts: ComplianceAlert[] = [];

  if (params.carrierId) {
    const carrier = await prisma.carrier.findFirst({
      where: { id: params.carrierId, deletedAt: null },
      include: { documents: { where: { deletedAt: null, isCurrent: true } } },
    });
    if (carrier) {
      const reqs = await prisma.complianceRequirement.findMany({
        where: { entityType: "CARRIER", isActive: true },
      });
      const byType = new Map(carrier.documents.map((d) => [d.documentType.toUpperCase(), d]));
      for (const req of reqs) {
        const doc = byType.get(req.documentType.toUpperCase());
        const status = buildComplianceStatus({
          required: req.isRequired,
          present: !!doc,
          expirationDate: doc?.expirationDate,
          expiresSoonDays: days,
        });
        if (status === "EXPIRED" || status === "EXPIRES_SOON" || status === "MISSING") {
          alerts.push({
            entityType: "CARRIER",
            entityId: carrier.id,
            entityLabel: carrier.legalName,
            documentType: req.documentType,
            status,
            expirationDate: doc?.expirationDate,
            message:
              status === "MISSING"
                ? `CARRIER ${req.label} MISSING`
                : status === "EXPIRED"
                  ? `CARRIER ${req.label} EXPIRED`
                  : `CARRIER ${req.label} EXPIRES SOON`,
          });
        }
      }
    }
  }

  if (params.driverId) {
    const driver = await prisma.driver.findFirst({
      where: { id: params.driverId, deletedAt: null },
      include: { documents: { where: { deletedAt: null, isCurrent: true } } },
    });
    if (driver) {
      // Field-level CDL / medical even without uploaded docs
      if (driver.cdlExpiration) {
        const status = evaluateDocumentStatus(driver.cdlExpiration, days);
        if (status === "EXPIRED" || status === "EXPIRES_SOON") {
          alerts.push({
            entityType: "DRIVER",
            entityId: driver.id,
            entityLabel: `${driver.firstName} ${driver.lastName}`,
            documentType: "CDL",
            status,
            expirationDate: driver.cdlExpiration,
            message:
              status === "EXPIRED"
                ? "DRIVER CDL EXPIRED"
                : `DRIVER CDL EXPIRES IN ${Math.max(0, Math.ceil((driver.cdlExpiration.getTime() - Date.now()) / 86400000))} DAYS`,
          });
        }
      }
      if (driver.medicalCardExpiration) {
        const status = evaluateDocumentStatus(driver.medicalCardExpiration, days);
        if (status === "EXPIRED" || status === "EXPIRES_SOON") {
          alerts.push({
            entityType: "DRIVER",
            entityId: driver.id,
            entityLabel: `${driver.firstName} ${driver.lastName}`,
            documentType: "MEDICAL_CARD",
            status,
            expirationDate: driver.medicalCardExpiration,
            message:
              status === "EXPIRED"
                ? "DRIVER MEDICAL CARD EXPIRED"
                : `MEDICAL CARD EXPIRES IN ${Math.max(0, Math.ceil((driver.medicalCardExpiration.getTime() - Date.now()) / 86400000))} DAYS`,
          });
        }
      }
    }
  }

  async function equipmentAlerts(
    id: string | null | undefined,
    kind: "TRACTOR" | "TRAILER",
    labelPrefix: string
  ) {
    if (!id) return;
    const docs = await prisma.equipmentDocument.findMany({
      where: {
        deletedAt: null,
        isCurrent: true,
        ...(kind === "TRACTOR" ? { tractorId: id } : { trailerId: id }),
      },
    });
    for (const doc of docs) {
      const status = evaluateDocumentStatus(doc.expirationDate, days);
      if (status === "EXPIRED" || status === "EXPIRES_SOON") {
        alerts.push({
          entityType: kind,
          entityId: id,
          entityLabel: `${labelPrefix}`,
          documentType: doc.documentType,
          status,
          expirationDate: doc.expirationDate,
          message:
            status === "EXPIRED"
              ? `${labelPrefix} ${doc.documentType} EXPIRED`
              : `${labelPrefix} ${doc.documentType} EXPIRES SOON`,
        });
      }
    }
  }

  await equipmentAlerts(params.tractorId, "TRACTOR", "TRACTOR");
  await equipmentAlerts(params.trailerId, "TRAILER", "TRAILER");

  return alerts;
}

export async function getDispatchComplianceMode(): Promise<string> {
  const s = await prisma.companySettings.findFirst();
  return s?.dispatchComplianceMode ?? "WARNING_ONLY";
}
