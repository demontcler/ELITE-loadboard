import Link from "next/link";
import {
  listInvoices,
  createInvoiceFromJob,
  markInvoiceSent,
  refreshInvoiceReadiness,
  recordCustomerPayment,
  listJobsReadyToInvoice,
} from "@/server/accounting";
import { DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { ActionButton, PaymentForm } from "@/components/accounting/accounting-actions";
import { Can } from "@/components/auth/can";
import { formatCurrencyPrecise } from "@/lib/utils";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const invoices = await listInvoices({ status: params.status || undefined });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Customer Invoices / AR</h2>
        <form className="flex gap-2">
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
          >
            <option value="">All statuses</option>
            {[
              "DRAFT",
              "NOT_READY",
              "READY_TO_INVOICE",
              "SENT",
              "PARTIALLY_PAID",
              "PAID",
              "OVERDUE",
              "DISPUTED",
              "VOID",
            ].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <button type="submit" className="h-8 rounded-md bg-slate-900 px-3 text-xs text-white">
            Filter
          </button>
        </form>
      </div>

      {invoices.length === 0 ? (
        <EmptyState message="No invoices yet. Create from Ready to Invoice." />
      ) : (
        <DataTable
          headers={[
            "Invoice",
            "Customer",
            "Job",
            "Date",
            "Due",
            "Total",
            "Paid",
            "Balance",
            "Status",
            "Hold",
            "Actions",
          ]}
        >
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">
                <Link href={`/accounting/invoices/${inv.id}`} className="text-blue-700 hover:underline">
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
                {inv.invoiceDate.toISOString().slice(0, 10)}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : "—"}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(inv.invoiceAmount.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(inv.amountPaid.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums font-medium">
                {formatCurrencyPrecise(inv.remainingBalance.toString())}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={inv.status} />
              </td>
              <td className="max-w-[160px] truncate px-3 py-2 text-xs text-red-700">
                {inv.holdReason || "—"}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  <Can permission="accounting:write">
                    <ActionButton
                      label="Refresh"
                      action={async () => {
                        "use server";
                        await refreshInvoiceReadiness(inv.id);
                      }}
                    />
                    {inv.status === "READY_TO_INVOICE" || inv.status === "DRAFT" ? (
                      <ActionButton
                        label="Mark Sent"
                        variant="primary"
                        action={async () => {
                          "use server";
                          await markInvoiceSent(inv.id);
                        }}
                      />
                    ) : null}
                    {Number(inv.remainingBalance) > 0 &&
                    !["VOID", "DRAFT", "NOT_READY"].includes(inv.status) ? (
                      <PaymentForm
                        invoiceId={inv.id}
                        remainingBalance={formatCurrencyPrecise(inv.remainingBalance.toString())}
                        action={async (raw) => {
                          "use server";
                          await recordCustomerPayment(raw);
                        }}
                      />
                    ) : null}
                  </Can>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <ReadyInline createAction={createInvoiceFromJob} />
    </div>
  );
}

async function ReadyInline({
  createAction,
}: {
  createAction: (jobId: string) => Promise<unknown>;
}) {
  const ready = await listJobsReadyToInvoice().catch(() => []);
  if (ready.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
        Quick create from delivered jobs
      </div>
      <ul className="space-y-1">
        {ready.slice(0, 5).map((j) => (
          <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <Link href={`/jobs/${j.id}`} className="font-medium text-blue-700 hover:underline">
                {j.jobNumber}
              </Link>{" "}
              — {j.customer.companyName}{" "}
              {j.readiness.ready ? (
                <span className="text-emerald-700">Ready</span>
              ) : (
                <span className="text-red-700">Hold: {j.readiness.holds.join("; ")}</span>
              )}
            </span>
            <Can permission="accounting:write">
              <ActionButton
                label="Create Invoice"
                variant="primary"
                action={async () => {
                  "use server";
                  await createAction(j.id);
                }}
              />
            </Can>
          </li>
        ))}
      </ul>
    </div>
  );
}
