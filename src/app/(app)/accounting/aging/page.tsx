import Link from "next/link";
import { getArAging } from "@/server/accounting";
import { DataTable, EmptyState } from "@/components/shared/page-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyPrecise } from "@/lib/utils";

export default async function AgingPage() {
  const aging = await getArAging();

  const buckets = [
    { key: "current", label: "Current", total: aging.totals.current, rows: aging.buckets.current },
    { key: "d1_30", label: "1–30 days", total: aging.totals.d1_30, rows: aging.buckets.d1_30 },
    { key: "d31_60", label: "31–60 days", total: aging.totals.d31_60, rows: aging.buckets.d31_60 },
    { key: "d61_90", label: "61–90 days", total: aging.totals.d61_90, rows: aging.buckets.d61_90 },
    { key: "d90plus", label: "90+ days", total: aging.totals.d90plus, rows: aging.buckets.d90plus },
  ] as const;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">AR Aging</h2>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {buckets.map((b) => (
          <Card key={b.key}>
            <CardHeader className="pb-1">
              <CardTitle className="text-[11px] uppercase text-slate-500">{b.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold tabular-nums">
              {formatCurrencyPrecise(b.total.toString())}
            </CardContent>
          </Card>
        ))}
      </div>

      {buckets.map((b) => (
        <section key={b.key} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-slate-500">
            {b.label} ({b.rows.length})
          </h3>
          {b.rows.length === 0 ? (
            <EmptyState message="None" />
          ) : (
            <DataTable headers={["Invoice", "Customer", "Job", "Due", "Balance"]}>
              {b.rows.map((inv) => (
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
                  <td className="px-3 py-2">{inv.job?.jobNumber ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {(inv.dueDate ?? inv.invoiceDate).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {formatCurrencyPrecise(inv.remainingBalance.toString())}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      ))}
    </div>
  );
}
