import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  FileWarning,
  Truck,
  DollarSign,
  TrendingUp,
  CalendarClock,
  PackageCheck,
  ShieldAlert,
  FileText,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardMetrics } from "@/server/dashboard";
import { listPreparedFilters } from "@/server/reports";
import { formatCurrencyPrecise, formatPercent } from "@/lib/utils";

export default async function DashboardPage() {
  const [m, filters] = await Promise.all([getDashboardMetrics(), listPreparedFilters()]);

  const ops = [
    { label: "Today's Jobs", value: String(m.todayJobs), href: "/load-board?column=today", icon: ClipboardList },
    { label: "Future Jobs", value: String(m.futureJobs), href: "/load-board?column=future", icon: CalendarClock },
    { label: "Active Jobs", value: String(m.activeJobs), href: "/load-board", icon: ClipboardList },
    { label: "Active Trucks", value: String(m.activeTrucks), href: "/load-board?column=dispatched", icon: Truck },
    { label: "Trucks Needed", value: String(m.trucksNeeded), href: "/load-board?needsTrucks=1", icon: AlertTriangle },
    { label: "Trucks Dispatched", value: String(m.trucksDispatched), href: "/load-board?column=dispatched", icon: Truck },
    {
      label: "Delivered Today",
      value: String(m.trucksDeliveredToday),
      href: "/reports?report=delivered",
      icon: PackageCheck,
    },
    {
      label: "Jobs Missing Trucks",
      value: String(m.jobsMissingTrucks),
      href: "/reports?report=missing_trucks",
      icon: AlertTriangle,
    },
    {
      label: "Missing PODs",
      value: String(m.missingPods),
      href: "/documents?entityType=TRUCK_ASSIGNMENT&status=MISSING",
      icon: FileWarning,
    },
    {
      label: "Compliance Alerts",
      value: String(m.complianceAlerts),
      href: "/documents?status=EXPIRED",
      icon: ShieldAlert,
    },
  ];

  const financial = m.canSeeAccounting
    ? [
        {
          label: "Invoices Ready",
          value: String(m.invoicesReady ?? 0),
          href: "/accounting/invoices?status=READY_TO_INVOICE",
          icon: FileText,
        },
        {
          label: "Invoices On Hold",
          value: String(m.invoicesOnHold ?? 0),
          href: "/accounting/holds",
          icon: FileWarning,
        },
        {
          label: "Outstanding AR",
          value: formatCurrencyPrecise(m.outstandingAr?.toString()),
          href: "/accounting/aging",
          icon: DollarSign,
        },
        {
          label: "Overdue AR",
          value: formatCurrencyPrecise(m.overdueAr?.toString()),
          href: "/accounting/aging",
          icon: AlertTriangle,
        },
        {
          label: "Outstanding AP",
          value: formatCurrencyPrecise(m.outstandingAp?.toString()),
          href: "/accounting/payables",
          icon: Wallet,
        },
        {
          label: "AP On Hold",
          value: String(m.apOnHold ?? 0),
          href: "/accounting/holds",
          icon: FileWarning,
        },
        {
          label: "Revenue This Week",
          value: formatCurrencyPrecise(m.revenueWeek.toString()),
          href: "/reports?report=financial&preset=this_week",
          icon: DollarSign,
        },
        {
          label: "Revenue This Month",
          value: formatCurrencyPrecise(m.revenueMonth.toString()),
          href: "/reports?report=financial&preset=this_month",
          icon: DollarSign,
        },
        {
          label: "Gross Profit This Month",
          value: formatCurrencyPrecise(m.profitMonth.toString()),
          href: "/reports?report=financial&preset=this_month",
          icon: TrendingUp,
        },
        {
          label: "Gross Margin This Month",
          value: m.marginMonth ? formatPercent(m.marginMonth.toString()) : "—",
          href: "/reports?report=financial&preset=this_month",
          icon: TrendingUp,
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Operations Dashboard</h1>
        <p className="text-sm text-slate-500">
          Live metrics · timezone {m.timeZone}. Click any card for a filtered view.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Operations
        </h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {ops.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.label} href={card.href}>
                <Card className="h-full transition-colors hover:border-slate-300 hover:bg-slate-50">
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
                    <CardTitle className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {card.label}
                    </CardTitle>
                    <Icon className="h-3.5 w-3.5 text-slate-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-semibold tabular-nums text-slate-900">
                      {card.value}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {financial.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Accounting
          </h2>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {financial.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.label} href={card.href}>
                  <Card className="h-full transition-colors hover:border-slate-300 hover:bg-slate-50">
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
                      <CardTitle className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        {card.label}
                      </CardTitle>
                      <Icon className="h-3.5 w-3.5 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-semibold tabular-nums text-slate-900 sm:text-xl">
                        {card.value}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Quick Filters
        </h2>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Link
              key={f.id}
              href={f.href}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {f.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
