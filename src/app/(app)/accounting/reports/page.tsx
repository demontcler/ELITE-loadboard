import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { getJobProfitability } from "@/server/accounting";
import { DataTable, EmptyState } from "@/components/shared/page-chrome";
import { formatCurrencyPrecise, formatPercent } from "@/lib/utils";

export default async function AccountingReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  await requireUserPermission("accounting:read");
  const params = await searchParams;

  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["DRAFT", "CANCELLED"] },
    },
    select: {
      id: true,
      jobNumber: true,
      totalRevenue: true,
      totalCost: true,
      grossProfit: true,
      marginPercent: true,
      customer: { select: { companyName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const detail = params.jobId ? await getJobProfitability(params.jobId) : null;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">Job / Truck Profitability</h2>

      {jobs.length === 0 ? (
        <EmptyState message="No jobs to report." />
      ) : (
        <DataTable
          headers={["Job", "Customer", "Revenue", "Cost", "Profit", "Margin", ""]}
        >
          {jobs.map((j) => (
            <tr key={j.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">
                <Link href={`/jobs/${j.id}`} className="text-blue-700 hover:underline">
                  {j.jobNumber}
                </Link>
              </td>
              <td className="px-3 py-2">{j.customer.companyName}</td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(j.totalRevenue.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(j.totalCost.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(j.grossProfit.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatPercent(j.marginPercent.toString())}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/accounting/reports?jobId=${j.id}`}
                  className="text-xs text-blue-700 hover:underline"
                >
                  Drill down
                </Link>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {detail ? (
        <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold">
            {detail.job.jobNumber} — Truck Detail
            {detail.job.usedParentRate ? (
              <span className="ml-2 text-xs font-normal text-slate-500">
                Parent customerRate is authoritative for job revenue
              </span>
            ) : null}
          </h3>
          <div className="grid gap-2 sm:grid-cols-4 text-sm">
            <div>Revenue: {formatCurrencyPrecise(detail.job.revenue.toString())}</div>
            <div>
              Acc Rev: {formatCurrencyPrecise(detail.job.accessorialRevenue.toString())}
            </div>
            <div>Profit: {formatCurrencyPrecise(detail.job.grossProfit.toString())}</div>
            <div>Margin: {formatPercent(detail.job.marginPercent.toString())}</div>
          </div>
          <DataTable
            headers={[
              "Truck",
              "Carrier",
              "Driver",
              "Rev Alloc",
              "Carrier Cost",
              "Driver Cost",
              "Acc Cost",
              "Other",
              "Profit",
              "Margin",
            ]}
          >
            {detail.trucks.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{t.displayId}</td>
                <td className="px-3 py-2">{t.carrierName || "—"}</td>
                <td className="px-3 py-2">{t.driverName || "—"}</td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(t.revenueAllocation.toString())}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(t.carrierCost.toString())}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(t.driverCost.toString())}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(t.accessorialCost.toString())}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(t.otherCost.toString())}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(t.grossProfit.toString())}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatPercent(t.marginPercent.toString())}
                </td>
              </tr>
            ))}
          </DataTable>
        </section>
      ) : null}
    </div>
  );
}
