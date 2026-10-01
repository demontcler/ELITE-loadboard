import Link from "next/link";
import { getAccountingOverview } from "@/server/accounting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyPrecise, formatPercent } from "@/lib/utils";

export default async function AccountingOverviewPage() {
  const overview = await getAccountingOverview();

  const cards = [
    {
      label: "Unbilled Revenue",
      value: formatCurrencyPrecise(overview.unbilledRevenue.toString()),
      href: "/accounting/ready",
    },
    {
      label: "Invoices Ready",
      value: String(overview.invoicesReady),
      href: "/accounting/invoices?status=READY_TO_INVOICE",
    },
    {
      label: "Invoices On Hold",
      value: String(overview.invoicesOnHold),
      href: "/accounting/holds",
    },
    {
      label: "Outstanding AR",
      value: formatCurrencyPrecise(overview.outstandingAr.toString()),
      href: "/accounting/aging",
    },
    {
      label: "Overdue AR",
      value: formatCurrencyPrecise(overview.overdueAr.toString()),
      href: "/accounting/aging",
    },
    {
      label: "Outstanding AP",
      value: formatCurrencyPrecise(overview.outstandingAp.toString()),
      href: "/accounting/payables",
    },
    {
      label: "AP On Hold",
      value: String(overview.apOnHold),
      href: "/accounting/holds",
    },
    {
      label: "AP Ready",
      value: String(overview.apReady),
      href: "/accounting/payables?status=READY_FOR_APPROVAL",
    },
    {
      label: "Revenue This Week",
      value: formatCurrencyPrecise(overview.revenueWeek.toString()),
      href: "/accounting/reports",
    },
    {
      label: "Revenue This Month",
      value: formatCurrencyPrecise(overview.revenueMonth.toString()),
      href: "/accounting/reports",
    },
    {
      label: "Gross Profit (Month)",
      value: formatCurrencyPrecise(overview.profitMonth.toString()),
      href: "/accounting/reports",
    },
    {
      label: "Gross Margin (Month)",
      value: formatPercent(overview.marginMonth.toString()),
      href: "/accounting/reports",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Link key={c.label} href={c.href}>
          <Card className="h-full transition-colors hover:border-slate-300 hover:bg-slate-50">
            <CardHeader className="pb-1">
              <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold tabular-nums text-slate-900">
              {c.value}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
