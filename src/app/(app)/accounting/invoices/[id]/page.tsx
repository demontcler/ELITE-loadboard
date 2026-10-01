import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInvoice,
  markInvoiceSent,
  refreshInvoiceReadiness,
  recordCustomerPayment,
  getJobProfitability,
} from "@/server/accounting";
import { DataTable, StatusBadge } from "@/components/shared/page-chrome";
import { ActionButton, PaymentForm } from "@/components/accounting/accounting-actions";
import { Can } from "@/components/auth/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyPrecise, formatPercent } from "@/lib/utils";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const profit = invoice.jobId ? await getJobProfitability(invoice.jobId).catch(() => null) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{invoice.invoiceNumber}</h2>
          <p className="text-sm text-slate-500">
            {invoice.customer.companyName}
            {invoice.job ? (
              <>
                {" · "}
                <Link href={`/jobs/${invoice.job.id}`} className="text-blue-700 hover:underline">
                  {invoice.job.jobNumber}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={invoice.status} />
          <Can permission="accounting:write">
            <ActionButton
              label="Refresh Readiness"
              action={async () => {
                "use server";
                await refreshInvoiceReadiness(invoice.id);
              }}
            />
            {invoice.status !== "NOT_READY" && invoice.status !== "SENT" && invoice.status !== "PAID" ? (
              <ActionButton
                label="Mark Sent"
                variant="primary"
                action={async () => {
                  "use server";
                  await markInvoiceSent(invoice.id);
                }}
              />
            ) : null}
            {Number(invoice.remainingBalance) > 0 && !["VOID", "NOT_READY", "DRAFT"].includes(invoice.status) ? (
              <PaymentForm
                invoiceId={invoice.id}
                remainingBalance={formatCurrencyPrecise(invoice.remainingBalance.toString())}
                action={async (raw) => {
                  "use server";
                  await recordCustomerPayment(raw);
                }}
              />
            ) : null}
          </Can>
        </div>
      </div>

      {invoice.holdReason ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <strong>INVOICE HOLD</strong> — {invoice.holdReason}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Subtotal", invoice.subtotal],
          ["Accessorials", invoice.accessorialTotal],
          ["Total", invoice.invoiceAmount],
          ["Balance", invoice.remainingBalance],
        ].map(([label, val]) => (
          <Card key={label as string}>
            <CardHeader className="pb-1">
              <CardTitle className="text-[11px] uppercase text-slate-500">{label as string}</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold tabular-nums">
              {formatCurrencyPrecise((val as { toString(): string }).toString())}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Line Items</h3>
        <DataTable headers={["Description", "Qty", "Unit", "Amount"]}>
          {invoice.lineItems.map((li) => (
            <tr key={li.id} className="border-t border-slate-100">
              <td className="px-3 py-2">{li.description}</td>
              <td className="px-3 py-2 tabular-nums">{li.quantity.toString()}</td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(li.unitPrice.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums font-medium">
                {formatCurrencyPrecise(li.amount.toString())}
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Payments</h3>
        {invoice.payments.length === 0 ? (
          <p className="text-sm text-slate-400">No payments recorded.</p>
        ) : (
          <DataTable headers={["Date", "Amount", "Method", "Reference", "Notes"]}>
            {invoice.payments.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2 tabular-nums">
                  {p.paymentDate.toISOString().slice(0, 10)}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(p.amount.toString())}
                </td>
                <td className="px-3 py-2">{p.paymentMethod || "—"}</td>
                <td className="px-3 py-2">{p.referenceNumber || "—"}</td>
                <td className="px-3 py-2">{p.notes || "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      {profit ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">
            Job Profitability
            {profit.job.usedParentRate ? (
              <span className="ml-2 text-xs font-normal text-slate-500">
                (parent customerRate authoritative)
              </span>
            ) : (
              <span className="ml-2 text-xs font-normal text-slate-500">
                (sum of truck allocations)
              </span>
            )}
          </h3>
          <div className="mb-2 grid gap-2 sm:grid-cols-4">
            <div className="rounded border bg-white px-3 py-2 text-sm">
              Revenue: {formatCurrencyPrecise(profit.job.revenue.toString())}
            </div>
            <div className="rounded border bg-white px-3 py-2 text-sm">
              Costs:{" "}
              {formatCurrencyPrecise(
                profit.job.carrierCosts
                  .plus(profit.job.driverCosts)
                  .plus(profit.job.accessorialCosts)
                  .plus(profit.job.otherCosts)
                  .toString()
              )}
            </div>
            <div className="rounded border bg-white px-3 py-2 text-sm">
              Profit: {formatCurrencyPrecise(profit.job.grossProfit.toString())}
            </div>
            <div className="rounded border bg-white px-3 py-2 text-sm">
              Margin: {formatPercent(profit.job.marginPercent.toString())}
            </div>
          </div>
          <DataTable
            headers={[
              "Truck",
              "Carrier",
              "Rev Alloc",
              "Carrier Cost",
              "Acc Cost",
              "Profit",
              "Margin",
            ]}
          >
            {profit.trucks.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{t.displayId}</td>
                <td className="px-3 py-2">{t.carrierName || "—"}</td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(t.revenueAllocation.toString())}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(t.carrierCost.toString())}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrencyPrecise(t.accessorialCost.toString())}
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
        </div>
      ) : null}
    </div>
  );
}
