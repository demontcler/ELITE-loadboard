import { listAccessorials, addAccessorial } from "@/server/accounting";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { AccessorialForm } from "@/components/accounting/accounting-actions";
import { Can } from "@/components/auth/can";
import { formatCurrencyPrecise } from "@/lib/utils";
import Link from "next/link";

export default async function AccessorialsPage() {
  await requireUserPermission("accounting:read");
  const [rows, trucks] = await Promise.all([
    listAccessorials(),
    prisma.truckAssignment.findMany({
      where: { deletedAt: null, status: { not: "CANCELLED" } },
      select: {
        id: true,
        displayId: true,
        job: { select: { jobNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">Accessorials</h2>
      <Can permission="accounting:write">
        <AccessorialForm
          truckOptions={trucks.map((t) => ({
            value: t.id,
            label: `${t.job.jobNumber} / ${t.displayId}`,
          }))}
          action={async (raw) => {
            "use server";
            await addAccessorial(raw);
          }}
        />
      </Can>

      {rows.length === 0 ? (
        <EmptyState message="No accessorials recorded." />
      ) : (
        <DataTable
          headers={[
            "Type",
            "Job / Truck",
            "Amount",
            "Customer",
            "Carrier",
            "Bill?",
            "Pay?",
            "Approval",
          ]}
        >
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">
                {a.type.replaceAll("_", " ")}
                {a.description ? (
                  <div className="text-xs font-normal text-slate-500">{a.description}</div>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/jobs/${a.truckAssignment.job.id}`}
                  className="text-blue-700 hover:underline"
                >
                  {a.truckAssignment.job.jobNumber}
                </Link>{" "}
                / {a.truckAssignment.displayId}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(a.amount.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {a.customerAmount ? formatCurrencyPrecise(a.customerAmount.toString()) : "—"}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {a.carrierAmount ? formatCurrencyPrecise(a.carrierAmount.toString()) : "—"}
              </td>
              <td className="px-3 py-2">{a.billToCustomer ? "Yes" : "No"}</td>
              <td className="px-3 py-2">{a.payToCarrier ? "Yes" : "No"}</td>
              <td className="px-3 py-2">
                <StatusBadge status={a.approvalStatus} />
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
