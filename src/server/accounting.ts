"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type InvoiceStatus, type PayableStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import { generateDisplayIdInTransaction } from "@/lib/identifiers";
import { calculateProfitability, sumDecimals } from "@/lib/calculations/financial";
import { getJobPaperwork, getTruckPaperwork } from "@/server/documents";
import { ActionError, emptyToNull, parseWithFieldErrors } from "@/lib/validators/form";
import { z } from "zod";

function dec(v: string | number | null | undefined): Prisma.Decimal {
  if (v === null || v === undefined || v === "") return new Prisma.Decimal(0);
  return new Prisma.Decimal(v);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getAccountingOverview() {
  await requireUserPermission("accounting:read");
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [invoices, payables, jobs] = await Promise.all([
    prisma.invoice.findMany({ where: { deletedAt: null }, take: 500 }),
    prisma.carrierPayable.findMany({ where: { deletedAt: null }, take: 500 }),
    prisma.job.findMany({
      where: { deletedAt: null, status: { notIn: ["CANCELLED", "DRAFT"] } },
      select: {
        id: true,
        totalRevenue: true,
        grossProfit: true,
        marginPercent: true,
        customerRate: true,
        createdAt: true,
        status: true,
      },
      take: 500,
    }),
  ]);

  const readyToInvoice = invoices.filter((i) => i.status === "READY_TO_INVOICE").length;
  const onHold = invoices.filter((i) => i.status === "NOT_READY" || !!i.holdReason).length;
  const outstandingAr = sumDecimals(
    invoices
      .filter((i) => !["PAID", "VOID", "DRAFT"].includes(i.status))
      .map((i) => i.remainingBalance.toString())
  );
  const overdueAr = sumDecimals(
    invoices
      .filter((i) => i.dueDate && i.dueDate < now && Number(i.remainingBalance) > 0 && i.status !== "VOID")
      .map((i) => i.remainingBalance.toString())
  );
  const outstandingAp = sumDecimals(
    payables
      .filter((p) => !["PAID", "VOID"].includes(p.status))
      .map((p) => p.totalPayable.toString())
  );
  const apOnHold = payables.filter((p) => p.status === "PAPERWORK_HOLD").length;
  const apReady = payables.filter((p) =>
    ["READY_FOR_APPROVAL", "APPROVED", "SCHEDULED"].includes(p.status)
  ).length;

  const weekJobs = jobs.filter((j) => j.createdAt >= weekStart);
  const monthJobs = jobs.filter((j) => j.createdAt >= monthStart);
  const revenueWeek = sumDecimals(weekJobs.map((j) => j.totalRevenue.toString()));
  const revenueMonth = sumDecimals(monthJobs.map((j) => j.totalRevenue.toString()));
  const profitMonth = sumDecimals(monthJobs.map((j) => j.grossProfit.toString()));
  const marginMonth = calculateProfitability({
    revenue: revenueMonth,
    cost: revenueMonth.minus(profitMonth),
  }).marginPercent;

  // Unbilled = jobs with revenue but no non-void invoice
  const invoicedJobIds = new Set(
    invoices.filter((i) => i.jobId && i.status !== "VOID").map((i) => i.jobId!)
  );
  const unbilled = sumDecimals(
    jobs.filter((j) => !invoicedJobIds.has(j.id)).map((j) => j.totalRevenue.toString())
  );

  return {
    unbilledRevenue: unbilled,
    invoicesReady: readyToInvoice,
    invoicesOnHold: onHold,
    outstandingAr,
    overdueAr,
    outstandingAp,
    apOnHold,
    apReady,
    revenueWeek,
    revenueMonth,
    profitMonth,
    marginMonth,
  };
}

export async function evaluateInvoiceReadiness(jobId: string) {
  await requireUserPermission("accounting:read");
  const paperwork = await getJobPaperwork(jobId);
  const holds = paperwork.job.incompleteTrucks.map(
    (t) => `${t.displayId} — ${t.missing.join(", ")} MISSING`
  );
  return {
    ready: paperwork.job.complete,
    holds,
    summary: paperwork.job,
  };
}

export async function createInvoiceFromJob(jobId: string) {
  const session = await requireUserPermission("accounting:write");
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: {
      customer: true,
      trucks: { where: { deletedAt: null }, include: { accessorials: { where: { deletedAt: null } } } },
    },
  });
  if (!job) throw new ActionError("Job not found");

  const readiness = await evaluateInvoiceReadiness(jobId);
  const accessorialBillable = sumDecimals(
    job.trucks.flatMap((t) =>
      t.accessorials.filter((a) => a.billToCustomer).map((a) => (a.customerAmount ?? a.amount).toString())
    )
  );
  const subtotal = job.customerRate
    ? new Prisma.Decimal(job.customerRate.toString())
    : new Prisma.Decimal(job.totalRevenue.toString());
  const total = subtotal.plus(accessorialBillable);

  const terms = job.customer.paymentTerms.replaceAll("_", " ");
  const dueDate = new Date();
  const netMatch = terms.match(/NET\s*(\d+)/i);
  dueDate.setDate(dueDate.getDate() + (netMatch ? Number(netMatch[1]) : 30));

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateDisplayIdInTransaction(tx, "invoice");
    const status: InvoiceStatus = readiness.ready ? "READY_TO_INVOICE" : "NOT_READY";
    const created = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId: job.customerId,
        jobId: job.id,
        invoiceDate: new Date(),
        dueDate,
        terms,
        subtotal,
        accessorialTotal: accessorialBillable,
        invoiceAmount: total,
        amountPaid: 0,
        remainingBalance: total,
        status,
        holdReason: readiness.ready ? null : readiness.holds.join("; "),
        lineItems: {
          create: [
            {
              description: `Transportation — ${job.trucksRequired} Trucks (${job.jobNumber})`,
              quantity: 1,
              unitPrice: subtotal,
              amount: subtotal,
              sortOrder: 0,
            },
            ...job.trucks.flatMap((t) =>
              t.accessorials
                .filter((a) => a.billToCustomer)
                .map((a, idx) => ({
                  description: `${a.type.replaceAll("_", " ")} — ${t.displayId}${a.description ? `: ${a.description}` : ""}`,
                  quantity: new Prisma.Decimal(1),
                  unitPrice: a.customerAmount ?? a.amount,
                  amount: a.customerAmount ?? a.amount,
                  sortOrder: 10 + idx,
                }))
            ),
          ],
        },
      },
    });
    return created;
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "invoice.created",
    entityType: "Invoice",
    entityId: invoice.id,
    newValue: {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amount: invoice.invoiceAmount.toString(),
      holdReason: invoice.holdReason,
    },
  });

  revalidatePath("/accounting");
  revalidatePath(`/jobs/${jobId}`);
  return invoice;
}

export async function refreshInvoiceReadiness(invoiceId: string) {
  const session = await requireUserPermission("accounting:write");
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
  });
  if (!invoice?.jobId) throw new ActionError("Invoice not found or not linked to a job");
  if (["PAID", "VOID", "SENT", "PARTIALLY_PAID", "PARTIAL_PAYMENT"].includes(invoice.status)) {
    // still refresh hold reason for sent invoices informationally
  }
  const readiness = await evaluateInvoiceReadiness(invoice.jobId);
  let status = invoice.status;
  if (invoice.status === "NOT_READY" || invoice.status === "READY_TO_INVOICE" || invoice.status === "DRAFT") {
    status = readiness.ready ? "READY_TO_INVOICE" : "NOT_READY";
  }
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status,
      holdReason: readiness.ready ? null : readiness.holds.join("; "),
    },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "invoice.readiness_refreshed",
    entityType: "Invoice",
    entityId: invoiceId,
    newValue: { status: updated.status, holdReason: updated.holdReason },
  });
  revalidatePath("/accounting");
  return updated;
}

export async function markInvoiceSent(invoiceId: string) {
  const session = await requireUserPermission("accounting:write");
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, deletedAt: null } });
  if (!invoice) throw new ActionError("Invoice not found");
  if (invoice.status === "NOT_READY") throw new ActionError("Invoice is on paperwork hold");
  if (["PAID", "VOID"].includes(invoice.status)) {
    throw new ActionError("Cannot change status of a paid or void invoice");
  }
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "SENT", sentAt: new Date() },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "invoice.sent",
    entityType: "Invoice",
    entityId: invoiceId,
  });
  revalidatePath("/accounting");
  return updated;
}

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  paymentDate: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function recordCustomerPayment(raw: unknown) {
  const session = await requireUserPermission("accounting:write");
  const parsed = parseWithFieldErrors(paymentSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const amount = dec(data.amount as string | number);
  if (amount.lte(0)) throw new ActionError("Payment amount must be positive");

  const invoice = await prisma.invoice.findFirst({ where: { id: data.invoiceId, deletedAt: null } });
  if (!invoice) throw new ActionError("Invoice not found");
  if (["VOID"].includes(invoice.status)) throw new ActionError("Cannot pay a void invoice");
  if (invoice.status === "PAID") throw new ActionError("Invoice is already paid");
  if (["DRAFT", "NOT_READY"].includes(invoice.status)) {
    throw new ActionError("Invoice is not ready to accept payments");
  }

  const newPaid = new Prisma.Decimal(invoice.amountPaid.toString()).plus(amount);
  const remaining = new Prisma.Decimal(invoice.invoiceAmount.toString()).minus(newPaid);
  if (remaining.lt(-0.001)) throw new ActionError("Payment exceeds remaining balance");

  let status: InvoiceStatus = invoice.status;
  if (remaining.lte(0.001)) status = "PAID";
  else if (newPaid.gt(0)) status = "PARTIALLY_PAID";

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.customerPayment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        paymentDate: parseDate(data.paymentDate) ?? new Date(),
        paymentMethod: data.paymentMethod || null,
        referenceNumber: data.referenceNumber || null,
        notes: data.notes || null,
        createdById: session.user.id,
      },
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newPaid,
        remainingBalance: Prisma.Decimal.max(remaining, new Prisma.Decimal(0)),
        status,
        paidAt: status === "PAID" ? new Date() : invoice.paidAt,
      },
    });
    return p;
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "payment.recorded",
    entityType: "Invoice",
    entityId: invoice.id,
    newValue: { paymentId: payment.id, amount: amount.toString(), status },
  });
  revalidatePath("/accounting");
  return payment;
}

export async function listInvoices(filters?: { status?: string; customerId?: string }) {
  await requireUserPermission("accounting:read");
  return prisma.invoice.findMany({
    where: {
      deletedAt: null,
      ...(filters?.status ? { status: filters.status as InvoiceStatus } : {}),
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
    },
    include: {
      customer: { select: { id: true, companyName: true } },
      job: { select: { id: true, jobNumber: true } },
      _count: { select: { payments: true, lineItems: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getInvoice(id: string) {
  await requireUserPermission("accounting:read");
  return prisma.invoice.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: true,
      job: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      payments: { where: { deletedAt: null }, orderBy: { paymentDate: "desc" } },
    },
  });
}

export async function getArAging() {
  await requireUserPermission("accounting:read");
  const now = new Date();
  const invoices = await prisma.invoice.findMany({
    where: {
      deletedAt: null,
      remainingBalance: { gt: 0 },
      status: { notIn: ["VOID", "DRAFT", "PAID"] },
    },
    include: { customer: { select: { companyName: true } }, job: { select: { jobNumber: true } } },
  });

  const buckets = {
    current: [] as typeof invoices,
    d1_30: [] as typeof invoices,
    d31_60: [] as typeof invoices,
    d61_90: [] as typeof invoices,
    d90plus: [] as typeof invoices,
  };

  for (const inv of invoices) {
    const due = inv.dueDate ?? inv.invoiceDate;
    const days = Math.floor((now.getTime() - due.getTime()) / 86400000);
    if (days <= 0) buckets.current.push(inv);
    else if (days <= 30) buckets.d1_30.push(inv);
    else if (days <= 60) buckets.d31_60.push(inv);
    else if (days <= 90) buckets.d61_90.push(inv);
    else buckets.d90plus.push(inv);
  }

  function sum(list: typeof invoices) {
    return sumDecimals(list.map((i) => i.remainingBalance.toString()));
  }

  return {
    buckets,
    totals: {
      current: sum(buckets.current),
      d1_30: sum(buckets.d1_30),
      d31_60: sum(buckets.d31_60),
      d61_90: sum(buckets.d61_90),
      d90plus: sum(buckets.d90plus),
    },
  };
}

/** Core payable sync — caller must already have authenticated. */
async function syncCarrierPayableCore(truckAssignmentId: string, userId: string) {
  const truck = await prisma.truckAssignment.findFirst({
    where: { id: truckAssignmentId, deletedAt: null },
    include: {
      accessorials: { where: { deletedAt: null } },
      job: { select: { id: true, jobNumber: true } },
    },
  });
  if (!truck) throw new ActionError("Truck assignment not found");
  if (!truck.carrierId) throw new ActionError("Truck has no carrier assigned");

  const { paperwork } = await getTruckPaperwork(truckAssignmentId);
  const accessorialPay = sumDecimals(
    truck.accessorials.filter((a) => a.payToCarrier).map((a) => (a.carrierAmount ?? a.amount).toString())
  );
  const baseRate = truck.carrierRate ?? new Prisma.Decimal(0);
  const total = new Prisma.Decimal(baseRate.toString()).plus(accessorialPay);
  const complete = !paperwork.paymentHold;
  const holdReason = paperwork.holdReasons.join("; ") || null;
  const status: PayableStatus = complete ? "READY_FOR_APPROVAL" : "PAPERWORK_HOLD";

  const existing = await prisma.carrierPayable.findFirst({
    where: { truckAssignmentId, deletedAt: null },
  });

  let payable;
  if (existing) {
    // Don't regress PAID/VOID/APPROVED/SCHEDULED except paperwork hold apply/release
    let nextStatus = existing.status;
    if (["PAPERWORK_HOLD", "NOT_READY", "READY_FOR_APPROVAL"].includes(existing.status)) {
      nextStatus = status;
    } else if (!complete && !["PAID", "VOID"].includes(existing.status)) {
      nextStatus = "PAPERWORK_HOLD";
    }
    payable = await prisma.carrierPayable.update({
      where: { id: existing.id },
      data: {
        baseRate,
        accessorialPay,
        totalPayable: total,
        paperworkComplete: complete,
        paperworkHoldReason: holdReason,
        status: nextStatus,
        carrierId: truck.carrierId,
        driverId: truck.driverId,
      },
    });
  } else {
    payable = await prisma.$transaction(async (tx) => {
      const settings = await tx.companySettings.findFirst();
      const year = new Date().getFullYear();
      const seq = settings?.nextSettlementSequence ?? 1;
      if (settings) {
        await tx.companySettings.update({
          where: { id: settings.id },
          data: { nextSettlementSequence: seq + 1 },
        });
      }
      const payableNumber = `PAY-${year}-${String(seq).padStart(5, "0")}`;
      return tx.carrierPayable.create({
        data: {
          payableNumber,
          carrierId: truck.carrierId!,
          driverId: truck.driverId,
          jobId: truck.jobId,
          truckAssignmentId: truck.id,
          baseRate,
          accessorialPay,
          totalPayable: total,
          paperworkComplete: complete,
          paperworkHoldReason: holdReason,
          status,
        },
      });
    });
  }

  await writeAuditLog({
    userId,
    action: existing ? "payable.synced" : "payable.created",
    entityType: "CarrierPayable",
    entityId: payable.id,
    newValue: {
      status: payable.status,
      total: payable.totalPayable.toString(),
      hold: payable.paperworkHoldReason,
    },
  });
  revalidatePath("/accounting");
  return payable;
}

/** Sync or create payable for a truck from rates + paperwork. */
export async function syncCarrierPayable(truckAssignmentId: string) {
  const session = await requireUserPermission("accounting:write");
  return syncCarrierPayableCore(truckAssignmentId, session.user.id);
}

/**
 * Recalculate payable/invoice holds after paperwork upload.
 * Callable by dispatchers (documents:write) without accounting:write.
 */
export async function recalculatePaperworkHolds(truckAssignmentId: string) {
  const session = await requireUserPermission("documents:write");
  const truck = await prisma.truckAssignment.findFirst({
    where: { id: truckAssignmentId, deletedAt: null },
    select: { id: true, jobId: true, carrierId: true },
  });
  if (!truck) return null;
  let payable = null;
  if (truck.carrierId) {
    payable = await syncCarrierPayableCore(truckAssignmentId, session.user.id).catch(() => null);
  }
  if (truck.jobId) {
    await refreshInvoicesForJob(truck.jobId, session.user.id).catch(() => undefined);
  }
  revalidatePath("/accounting");
  return payable;
}

export async function refreshInvoicesForJob(jobId: string, userId?: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      jobId,
      deletedAt: null,
      status: { in: ["DRAFT", "NOT_READY", "READY_TO_INVOICE"] },
    },
  });
  const readiness = await evaluateInvoiceReadiness(jobId);
  for (const invoice of invoices) {
    const status: InvoiceStatus = readiness.ready ? "READY_TO_INVOICE" : "NOT_READY";
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status,
        holdReason: readiness.ready ? null : readiness.holds.join("; "),
      },
    });
    if (userId) {
      await writeAuditLog({
        userId,
        action: "invoice.readiness_refreshed",
        entityType: "Invoice",
        entityId: invoice.id,
        newValue: { status, holdReason: readiness.ready ? null : readiness.holds.join("; ") },
      });
    }
  }
  return { refreshed: invoices.length, ready: readiness.ready, holds: readiness.holds };
}

export async function syncJobPayables(jobId: string) {
  await requireUserPermission("accounting:write");
  const trucks = await prisma.truckAssignment.findMany({
    where: { jobId, deletedAt: null, carrierId: { not: null } },
    select: { id: true },
  });
  const results = [];
  for (const t of trucks) {
    results.push(await syncCarrierPayable(t.id));
  }
  return results;
}

export async function approvePayable(payableId: string) {
  const session = await requireUserPermission("accounting:approve_payment");
  const payable = await prisma.carrierPayable.findFirst({ where: { id: payableId, deletedAt: null } });
  if (!payable) throw new ActionError("Payable not found");
  if (payable.status === "PAPERWORK_HOLD") throw new ActionError("Cannot approve — paperwork hold");
  const updated = await prisma.carrierPayable.update({
    where: { id: payableId },
    data: { status: "APPROVED", approvalStatus: "APPROVED" },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "payable.approved",
    entityType: "CarrierPayable",
    entityId: payableId,
  });
  revalidatePath("/accounting");
  return updated;
}

export async function markPayablePaid(
  payableId: string,
  raw?: { paymentDate?: string; paymentMethod?: string; referenceNumber?: string }
) {
  const session = await requireUserPermission("accounting:approve_payment");
  const payable = await prisma.carrierPayable.findFirst({ where: { id: payableId, deletedAt: null } });
  if (!payable) throw new ActionError("Payable not found");
  if (payable.status === "PAPERWORK_HOLD") throw new ActionError("Cannot pay — paperwork hold");
  if (payable.status === "PAID") throw new ActionError("Payable is already paid");
  if (payable.status === "VOID") throw new ActionError("Cannot pay a void payable");
  const updated = await prisma.carrierPayable.update({
    where: { id: payableId },
    data: {
      status: "PAID",
      paymentDate: parseDate(raw?.paymentDate) ?? new Date(),
      paymentMethod: raw?.paymentMethod || "ACH",
      referenceNumber: raw?.referenceNumber || null,
    },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: "payable.paid",
    entityType: "CarrierPayable",
    entityId: payableId,
  });
  revalidatePath("/accounting");
  return updated;
}

export async function listPayables(filters?: { status?: string; carrierId?: string }) {
  await requireUserPermission("accounting:read");
  return prisma.carrierPayable.findMany({
    where: {
      deletedAt: null,
      ...(filters?.status ? { status: filters.status as PayableStatus } : {}),
      ...(filters?.carrierId ? { carrierId: filters.carrierId } : {}),
    },
    include: {
      carrier: { select: { id: true, legalName: true } },
      truckAssignment: {
        select: {
          id: true,
          displayId: true,
          job: { select: { id: true, jobNumber: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function createSettlementFromPayables(payableIds: string[]) {
  const session = await requireUserPermission("accounting:write");
  if (!payableIds.length) throw new ActionError("Select at least one payable");
  const payables = await prisma.carrierPayable.findMany({
    where: { id: { in: payableIds }, deletedAt: null },
  });
  if (payables.length === 0) throw new ActionError("No payables found");
  const carrierId = payables[0]!.carrierId;
  if (payables.some((p) => p.carrierId !== carrierId)) {
    throw new ActionError("All payables must belong to the same carrier");
  }
  if (payables.some((p) => p.status === "PAPERWORK_HOLD")) {
    throw new ActionError("Cannot settle payables on paperwork hold");
  }

  const basePay = sumDecimals(payables.map((p) => p.baseRate.toString()));
  const accessorialPay = sumDecimals(payables.map((p) => p.accessorialPay.toString()));
  const deductions = sumDecimals(payables.map((p) => p.deductions.toString()));
  const amount = basePay.plus(accessorialPay).minus(deductions);

  const settlement = await prisma.$transaction(async (tx) => {
    const settlementNumber = await generateDisplayIdInTransaction(tx, "settlement");
    const s = await tx.carrierSettlement.create({
      data: {
        settlementNumber,
        carrierId,
        amount,
        basePay,
        accessorialPay,
        deductions,
        documentsComplete: payables.every((p) => p.paperworkComplete),
        status: "READY_FOR_PAYMENT",
        lineItems: {
          create: payables.map((p, idx) => ({
            description: `${p.payableNumber} — ${p.truckAssignmentId}`,
            amount: p.totalPayable,
            sortOrder: idx,
          })),
        },
      },
    });
    await tx.carrierPayable.updateMany({
      where: { id: { in: payableIds } },
      data: { settlementId: s.id, status: "SCHEDULED" },
    });
    return s;
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "settlement.created",
    entityType: "CarrierSettlement",
    entityId: settlement.id,
    newValue: { settlementNumber: settlement.settlementNumber, amount: amount.toString() },
  });
  revalidatePath("/accounting");
  return settlement;
}

export async function listSettlements() {
  await requireUserPermission("accounting:read");
  return prisma.carrierSettlement.findMany({
    where: { deletedAt: null },
    include: {
      carrier: { select: { legalName: true } },
      payables: { select: { id: true, payableNumber: true, totalPayable: true } },
      _count: { select: { lineItems: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const accessorialSchema = z.object({
  truckAssignmentId: z.string().min(1),
  type: z.enum([
    "DETENTION",
    "LAYOVER",
    "TONU",
    "FUEL_SURCHARGE",
    "DRIVER_ASSIST",
    "TARP",
    "OVER_DIMENSIONAL",
    "LUMPER",
    "EXTRA_STOP",
    "PERMIT",
    "ESCORT",
    "ADDITIONAL_LABOR",
    "OTHER",
  ]),
  description: z.string().optional().nullable(),
  amount: z.union([z.string(), z.number()]),
  customerAmount: z.union([z.string(), z.number()]).optional().nullable(),
  carrierAmount: z.union([z.string(), z.number()]).optional().nullable(),
  billToCustomer: z.coerce.boolean().optional(),
  payToCarrier: z.coerce.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export async function addAccessorial(raw: unknown) {
  const session = await requireUserPermission("accounting:write");
  const parsed = parseWithFieldErrors(accessorialSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);
  const data = parsed.data;
  const amount = dec(data.amount as string | number);
  const row = await prisma.accessorial.create({
    data: {
      truckAssignmentId: data.truckAssignmentId,
      type: data.type,
      description: data.description || null,
      amount,
      customerAmount: data.customerAmount != null ? dec(data.customerAmount as string | number) : amount,
      carrierAmount: data.carrierAmount != null ? dec(data.carrierAmount as string | number) : null,
      billToCustomer: data.billToCustomer ?? true,
      payToCarrier: data.payToCarrier ?? false,
      notes: data.notes || null,
    },
  });
  const truck = await prisma.truckAssignment.findUnique({ where: { id: data.truckAssignmentId } });
  if (truck?.carrierId) {
    await syncCarrierPayable(data.truckAssignmentId).catch(() => undefined);
  }
  await writeAuditLog({
    userId: session.user.id,
    action: "accessorial.created",
    entityType: "Accessorial",
    entityId: row.id,
    newValue: { type: row.type, amount: row.amount.toString() },
  });
  if (truck) revalidatePath(`/jobs/${truck.jobId}`);
  revalidatePath("/accounting");
  return row;
}

export async function getJobProfitability(jobId: string) {
  await requireUserPermission("accounting:read");
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: {
      trucks: {
        where: { deletedAt: null },
        include: { accessorials: { where: { deletedAt: null } }, carrier: true, driver: true },
      },
    },
  });
  if (!job) return null;

  const trucks = job.trucks.map((t) => {
    const accessorialRevenue = sumDecimals(
      t.accessorials.filter((a) => a.billToCustomer).map((a) => (a.customerAmount ?? a.amount).toString())
    );
    const accessorialCost = sumDecimals(
      t.accessorials.filter((a) => a.payToCarrier).map((a) => (a.carrierAmount ?? a.amount).toString())
    );
    const carrierCost = t.carrierRate ?? new Prisma.Decimal(0);
    const driverCost = t.driverRate ?? new Prisma.Decimal(0);
    const revenue = t.revenueAllocation ?? new Prisma.Decimal(0);
    const profit = calculateProfitability({
      revenue: revenue.plus(accessorialRevenue),
      cost: carrierCost.plus(driverCost).plus(accessorialCost).plus(t.additionalCost),
    });
    return {
      id: t.id,
      displayId: t.displayId,
      carrierName: t.carrier?.legalName ?? null,
      driverName: t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : null,
      revenueAllocation: revenue,
      accessorialRevenue,
      carrierCost,
      driverCost,
      accessorialCost,
      otherCost: t.additionalCost,
      grossProfit: profit.grossProfit,
      marginPercent: profit.marginPercent,
    };
  });

  const jobRevenue = job.customerRate
    ? new Prisma.Decimal(job.customerRate.toString())
    : sumDecimals(trucks.map((t) => t.revenueAllocation.toString()));
  const jobAccessorialRev = sumDecimals(trucks.map((t) => t.accessorialRevenue.toString()));
  const jobCarrierCost = sumDecimals(trucks.map((t) => t.carrierCost.toString()));
  const jobDriverCost = sumDecimals(trucks.map((t) => t.driverCost.toString()));
  const jobAccessorialCost = sumDecimals(trucks.map((t) => t.accessorialCost.toString()));
  const jobOther = sumDecimals(trucks.map((t) => t.otherCost.toString()));
  const jobProfit = calculateProfitability({
    revenue: jobRevenue.plus(jobAccessorialRev),
    cost: jobCarrierCost.plus(jobDriverCost).plus(jobAccessorialCost).plus(jobOther),
  });

  return {
    job: {
      id: job.id,
      jobNumber: job.jobNumber,
      revenue: jobRevenue,
      accessorialRevenue: jobAccessorialRev,
      carrierCosts: jobCarrierCost,
      driverCosts: jobDriverCost,
      accessorialCosts: jobAccessorialCost,
      otherCosts: jobOther,
      grossProfit: jobProfit.grossProfit,
      marginPercent: jobProfit.marginPercent,
      usedParentRate: !!job.customerRate,
    },
    trucks,
  };
}

export async function listJobsReadyToInvoice() {
  await requireUserPermission("accounting:read");
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      status: { in: ["DELIVERED", "COMPLETED", "PARTIALLY_DELIVERED"] },
      invoices: { none: { deletedAt: null, status: { not: "VOID" } } },
    },
    include: {
      customer: { select: { companyName: true } },
      trucks: { where: { deletedAt: null }, select: { id: true, status: true } },
    },
    orderBy: { deliveryDate: "desc" },
    take: 100,
  });
  const withReadiness = [];
  for (const job of jobs) {
    const readiness = await evaluateInvoiceReadiness(job.id).catch(() => ({
      ready: false,
      holds: ["Unable to evaluate"],
      summary: null,
    }));
    withReadiness.push({ ...job, readiness });
  }
  return withReadiness;
}

export async function listAccessorials() {
  await requireUserPermission("accounting:read");
  return prisma.accessorial.findMany({
    where: { deletedAt: null },
    include: {
      truckAssignment: {
        select: {
          id: true,
          displayId: true,
          job: { select: { id: true, jobNumber: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function listPaymentsOnHold() {
  await requireUserPermission("accounting:read");
  const [invoiceHolds, payableHolds] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { in: ["NOT_READY", "DRAFT"] },
      },
      include: {
        customer: { select: { companyName: true } },
        job: { select: { id: true, jobNumber: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.carrierPayable.findMany({
      where: { deletedAt: null, status: "PAPERWORK_HOLD" },
      include: {
        carrier: { select: { legalName: true } },
        truckAssignment: {
          select: {
            displayId: true,
            job: { select: { id: true, jobNumber: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);
  return { invoiceHolds, payableHolds };
}
