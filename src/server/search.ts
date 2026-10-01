"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export type SearchResult = {
  type:
    | "JOB"
    | "CUSTOMER"
    | "CARRIER"
    | "DRIVER"
    | "TRACTOR"
    | "TRAILER"
    | "INVOICE"
    | "SETTLEMENT"
    | "DOCUMENT"
    | "CONTACT";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const session = await requireSession();
  const q = query.trim();
  if (q.length < 2) return [];

  const contains = { contains: q, mode: "insensitive" as const };
  const results: SearchResult[] = [];
  const role = session.user.role as Role;
  const canAccounting = hasPermission(role, "accounting:read");

  const [
    jobs,
    customers,
    contacts,
    carriers,
    drivers,
    tractors,
    trailers,
    bolPods,
    invoices,
    settlements,
    docFiles,
  ] = await Promise.all([
    prisma.job.findMany({
      where: {
        deletedAt: null,
        OR: [
          { jobNumber: contains },
          { customerPoNumber: contains },
          { customerReferenceNumber: contains },
          { orderNumber: contains },
          { rigName: contains },
          { leaseName: contains },
          { wellName: contains },
          { pickupName: contains },
          { pickupCity: contains },
          { deliveryName: contains },
          { deliveryCity: contains },
          { trucks: { some: { cargoItems: { some: { materialDescription: contains, deletedAt: null } } } } },
        ],
      },
      select: {
        id: true,
        jobNumber: true,
        pickupName: true,
        deliveryName: true,
        rigName: true,
        customer: { select: { companyName: true } },
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      where: {
        deletedAt: null,
        OR: [{ companyName: contains }, { dba: contains }, { mainPhone: contains }],
      },
      select: { id: true, companyName: true, dba: true, mainPhone: true },
      take: 6,
      orderBy: { companyName: "asc" },
    }),
    prisma.customerContact.findMany({
      where: {
        deletedAt: null,
        OR: [{ name: contains }, { email: contains }, { phone: contains }, { mobile: contains }],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        customer: { select: { id: true, companyName: true } },
      },
      take: 5,
    }),
    prisma.carrier.findMany({
      where: {
        deletedAt: null,
        OR: [
          { legalName: contains },
          { dba: contains },
          { mcNumber: contains },
          { usdotNumber: contains },
          { phone: contains },
        ],
      },
      select: { id: true, legalName: true, mcNumber: true, usdotNumber: true },
      take: 6,
      orderBy: { legalName: "asc" },
    }),
    prisma.driver.findMany({
      where: {
        deletedAt: null,
        OR: [{ firstName: contains }, { lastName: contains }, { phone: contains }, { cdlNumber: contains }],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        carrier: { select: { legalName: true } },
      },
      take: 6,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.tractor.findMany({
      where: {
        deletedAt: null,
        OR: [{ unitNumber: contains }, { licensePlate: contains }, { vin: contains }],
      },
      select: { id: true, unitNumber: true, make: true, model: true, year: true },
      take: 5,
      orderBy: { unitNumber: "asc" },
    }),
    prisma.trailer.findMany({
      where: {
        deletedAt: null,
        OR: [{ unitNumber: contains }, { licensePlate: contains }, { vin: contains }],
      },
      select: { id: true, unitNumber: true, trailerType: true, lengthFeet: true },
      take: 5,
      orderBy: { unitNumber: "asc" },
    }),
    prisma.truckAssignmentDocument.findMany({
      where: {
        deletedAt: null,
        isCurrent: true,
        OR: [
          { referenceNumber: contains },
          { fileName: contains },
          { documentType: contains },
        ],
      },
      select: {
        id: true,
        documentType: true,
        referenceNumber: true,
        fileName: true,
        truckAssignment: {
          select: {
            id: true,
            displayId: true,
            jobId: true,
            job: { select: { jobNumber: true } },
          },
        },
      },
      take: 6,
      orderBy: { uploadedAt: "desc" },
    }),
    canAccounting
      ? prisma.invoice.findMany({
          where: {
            deletedAt: null,
            OR: [{ invoiceNumber: contains }, { notes: contains }],
          },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            customer: { select: { companyName: true } },
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canAccounting
      ? prisma.carrierSettlement.findMany({
          where: {
            deletedAt: null,
            settlementNumber: contains,
          },
          select: {
            id: true,
            settlementNumber: true,
            status: true,
            carrier: { select: { legalName: true } },
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.customerDocument.findMany({
      where: {
        deletedAt: null,
        OR: [{ fileName: contains }, { referenceNumber: contains }],
      },
      select: {
        id: true,
        fileName: true,
        documentType: true,
        customerId: true,
        customer: { select: { companyName: true } },
      },
      take: 4,
    }),
  ]);

  for (const j of jobs) {
    results.push({
      type: "JOB",
      id: j.id,
      title: j.jobNumber,
      subtitle: [j.customer.companyName, j.pickupName, j.deliveryName || j.rigName]
        .filter(Boolean)
        .join(" · "),
      href: `/jobs/${j.id}`,
    });
  }
  for (const c of customers) {
    results.push({
      type: "CUSTOMER",
      id: c.id,
      title: c.companyName,
      subtitle: [c.dba, c.mainPhone].filter(Boolean).join(" · ") || undefined,
      href: `/customers/${c.id}`,
    });
  }
  for (const c of contacts) {
    results.push({
      type: "CONTACT",
      id: c.id,
      title: c.name,
      subtitle: [c.customer.companyName, c.phone].filter(Boolean).join(" · "),
      href: `/customers/${c.customer.id}`,
    });
  }
  for (const c of carriers) {
    results.push({
      type: "CARRIER",
      id: c.id,
      title: c.legalName,
      subtitle: [c.mcNumber ? `MC ${c.mcNumber}` : null, c.usdotNumber ? `USDOT ${c.usdotNumber}` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
      href: `/carriers/${c.id}`,
    });
  }
  for (const d of drivers) {
    results.push({
      type: "DRIVER",
      id: d.id,
      title: `${d.firstName} ${d.lastName}`,
      subtitle: [d.carrier?.legalName, d.phone].filter(Boolean).join(" · ") || undefined,
      href: `/drivers/${d.id}`,
    });
  }
  for (const t of tractors) {
    results.push({
      type: "TRACTOR",
      id: t.id,
      title: t.unitNumber,
      subtitle: [t.year, t.make, t.model].filter(Boolean).join(" ") || undefined,
      href: `/equipment/tractors/${t.id}`,
    });
  }
  for (const t of trailers) {
    results.push({
      type: "TRAILER",
      id: t.id,
      title: t.unitNumber,
      subtitle:
        [t.trailerType.replaceAll("_", " "), t.lengthFeet ? `${t.lengthFeet} ft` : null]
          .filter(Boolean)
          .join(" · ") || undefined,
      href: `/equipment/trailers/${t.id}`,
    });
  }
  for (const d of bolPods) {
    results.push({
      type: "DOCUMENT",
      id: d.id,
      title: `${d.documentType}${d.referenceNumber ? ` ${d.referenceNumber}` : ""}`,
      subtitle: `${d.truckAssignment.job.jobNumber} / ${d.truckAssignment.displayId} · ${d.fileName}`,
      href: `/jobs/${d.truckAssignment.jobId}`,
    });
  }
  for (const inv of invoices) {
    results.push({
      type: "INVOICE",
      id: inv.id,
      title: inv.invoiceNumber,
      subtitle: `${inv.customer.companyName} · ${inv.status}`,
      href: `/accounting/invoices/${inv.id}`,
    });
  }
  for (const s of settlements) {
    results.push({
      type: "SETTLEMENT",
      id: s.id,
      title: s.settlementNumber,
      subtitle: `${s.carrier.legalName} · ${s.status}`,
      href: `/accounting/settlements`,
    });
  }
  for (const d of docFiles) {
    results.push({
      type: "DOCUMENT",
      id: d.id,
      title: d.fileName,
      subtitle: `${d.documentType} · ${d.customer.companyName}`,
      href: `/customers/${d.customerId}`,
    });
  }

  return results.slice(0, 40);
}
