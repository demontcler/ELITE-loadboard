import Link from "next/link";
import { listJobsReadyToInvoice, createInvoiceFromJob, syncJobPayables } from "@/server/accounting";
import { DataTable, EmptyState } from "@/components/shared/page-chrome";
import { ActionButton } from "@/components/accounting/accounting-actions";
import { Can } from "@/components/auth/can";
import { formatCurrencyPrecise } from "@/lib/utils";

export default async function ReadyToInvoicePage() {
  const jobs = await listJobsReadyToInvoice();

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">Jobs Ready to Invoice</h2>
      <p className="text-xs text-slate-500">
        Delivered/completed jobs without an active invoice. Paperwork readiness is evaluated from
        Phase 5 BOL/POD requirements.
      </p>
      {jobs.length === 0 ? (
        <EmptyState message="No unbilled delivered jobs." />
      ) : (
        <DataTable headers={["Job", "Customer", "Trucks", "Revenue", "Readiness", "Actions"]}>
          {jobs.map((j) => (
            <tr key={j.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">
                <Link href={`/jobs/${j.id}`} className="text-blue-700 hover:underline">
                  {j.jobNumber}
                </Link>
              </td>
              <td className="px-3 py-2">{j.customer.companyName}</td>
              <td className="px-3 py-2 tabular-nums">{j.trucks.length}</td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(j.totalRevenue.toString())}
              </td>
              <td className="px-3 py-2 text-xs">
                {j.readiness.ready ? (
                  <span className="font-medium text-emerald-700">READY</span>
                ) : (
                  <span className="text-red-700">
                    INVOICE HOLD — {j.readiness.holds.join("; ")}
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  <Can permission="accounting:write">
                    <ActionButton
                      label="Create Invoice"
                      variant="primary"
                      action={async () => {
                        "use server";
                        await createInvoiceFromJob(j.id);
                      }}
                    />
                    <ActionButton
                      label="Sync Payables"
                      action={async () => {
                        "use server";
                        await syncJobPayables(j.id);
                      }}
                    />
                  </Can>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
