"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

export type SearchResult = {
  type: "JOB" | "CUSTOMER" | "CARRIER" | "DRIVER" | "TRACTOR" | "TRAILER";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export async function globalSearch(query: string): Promise<SearchResult[]> {
  await requireSession();
  const q = query.trim();
  if (q.length < 2) return [];

  const contains = { contains: q, mode: "insensitive" as const };
  const results: SearchResult[] = [];

  const [jobs, customers, carriers, drivers, tractors, trailers] = await Promise.all([
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
      where: { deletedAt: null, OR: [{ companyName: contains }, { dba: contains }, { mainPhone: contains }] },
      select: { id: true, companyName: true, dba: true, mainPhone: true },
      take: 6,
      orderBy: { companyName: "asc" },
    }),
    prisma.carrier.findMany({
      where: {
        deletedAt: null,
        OR: [{ legalName: contains }, { dba: contains }, { mcNumber: contains }, { usdotNumber: contains }, { phone: contains }],
      },
      select: { id: true, legalName: true, mcNumber: true },
      take: 6,
      orderBy: { legalName: "asc" },
    }),
    prisma.driver.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: contains },
          { lastName: contains },
          { phone: contains },
          { cdlNumber: contains },
        ],
      },
      select: { id: true, firstName: true, lastName: true, phone: true, carrier: { select: { legalName: true } } },
      take: 6,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.tractor.findMany({
      where: { deletedAt: null, OR: [{ unitNumber: contains }, { licensePlate: contains }, { vin: contains }] },
      select: { id: true, unitNumber: true, make: true, model: true, year: true },
      take: 5,
      orderBy: { unitNumber: "asc" },
    }),
    prisma.trailer.findMany({
      where: { deletedAt: null, OR: [{ unitNumber: contains }, { licensePlate: contains }, { vin: contains }] },
      select: { id: true, unitNumber: true, trailerType: true, lengthFeet: true },
      take: 5,
      orderBy: { unitNumber: "asc" },
    }),
  ]);

  for (const j of jobs) {
    results.push({
      type: "JOB",
      id: j.id,
      title: j.jobNumber,
      subtitle: [j.customer.companyName, j.pickupName, j.deliveryName || j.rigName].filter(Boolean).join(" · "),
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
  for (const c of carriers) {
    results.push({
      type: "CARRIER",
      id: c.id,
      title: c.legalName,
      subtitle: c.mcNumber ? `MC ${c.mcNumber}` : undefined,
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
      subtitle: [t.trailerType.replaceAll("_", " "), t.lengthFeet ? `${t.lengthFeet} ft` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
      href: `/equipment/trailers/${t.id}`,
    });
  }

  return results.slice(0, 30);
}
