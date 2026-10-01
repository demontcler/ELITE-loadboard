import Link from "next/link";
import { listPaymentsOnHold, refreshInvoiceReadiness, syncCarrierPayable } from "@/server/accounting";
import { DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { ActionButton } from "@/components/accounting/accounting-actions";
import { Can } from "@/components/auth/can";
import { formatCurrencyPrecise } from "@/lib/utils";

export default async function HoldsPage() {
  const { invoiceHolds, payableHolds } = await listPaymentsOnHold();

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Invoice Holds</h2>
        {invoiceHolds.length === 0 ? (
          <EmptyState message="No invoices on paperwork hold." />
        ) : (
          <DataTable headers={["Invoice", "Customer", "Job", "Amount", "Status", "Reason", ""]}>
            {invoiceHolds.map((inv) => (
              <tr key={inv.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">
                  <Link
                    href={`/accounting/invoices/${inv.id}`}
                    className="text-blue-700 hover:underline"
                  >
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">{inv.customer.companyName}</td>
                <td className="px-3 py-2">
                  {inv.job ? (
                    <Link href={`/jobs/${inv.job.id}`} className="text-blue-700 hover:underline">
                      {inv.job.jobNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(inv.invoiceAmount.toString())}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={inv.status} />
                </td>
                <td className="px-3 py-2 text-xs text-red-700">{inv.holdReason || "—"}</td>
                <td className="px-3 py-2">
                  <Can permission="accounting:write">
                    <ActionButton
                      label="Recheck"
                      action={async () => {
                        "use server";
                        await refreshInvoiceReadiness(inv.id);
                      }}
                    />
                  </Can>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Carrier Payment Holds</h2>
        {payableHolds.length === 0 ? (
          <EmptyState message="No payables on paperwork hold." />
        ) : (
          <DataTable headers={["Payable", "Carrier", "Job / Truck", "Total", "Reason", ""]}>
            {payableHolds.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{p.payableNumber}</td>
                <td className="px-3 py-2">{p.carrier.legalName}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/jobs/${p.truckAssignment.job.id}`}
                    className="text-blue-700 hover:underline"
                  >
                    {p.truckAssignment.job.jobNumber}
                  </Link>{" "}
                  / {p.truckAssignment.displayId}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(p.totalPayable.toString())}
                </td>
                <td className="px-3 py-2 text-xs text-red-700">
                  {p.paperworkHoldReason || "PAYMENT HOLD"}
                </td>
                <td className="px-3 py-2">
                  <Can permission="accounting:write">
                    <ActionButton
                      label="Recheck"
                      action={async () => {
                        "use server";
                        await syncCarrierPayable(p.truckAssignmentId);
                      }}
                    />
                  </Can>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
