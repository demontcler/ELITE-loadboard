import Link from "next/link";
import {
  reportJobsByCustomer,
  reportJobsByStatus,
  reportTruckMovements,
  reportLoadsByCarrier,
  reportMaterialHauled,
  reportJobsMissingTrucks,
  reportFinancialSummary,
  listPreparedFilters,
} from "@/server/reports";
import { PageHeader, DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { DATE_PRESET_OPTIONS } from "@/lib/dates/ranges";
import { formatCurrencyPrecise, formatPercent, formatWeight, formatFootage } from "@/lib/utils";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

const REPORTS = [
  { id: "jobs_customer", label: "Jobs by Customer" },
  { id: "jobs_status", label: "Jobs by Status" },
  { id: "truck_movements", label: "Truck Movements" },
  { id: "loads_carrier", label: "Loads by Carrier" },
  { id: "material", label: "Material / Pipe / Weight" },
  { id: "missing_trucks", label: "Jobs Missing Trucks" },
  { id: "financial", label: "Financial Summary" },
] as const;

type ReportId = (typeof REPORTS)[number]["id"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    report?: string;
    preset?: string;
    start?: string;
    end?: string;
  }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const report = (params.report || "jobs_customer") as ReportId;
  const preset = params.preset || "this_month";
  const rangeParams = { preset, start: params.start, end: params.end };
  const canFinance = hasPermission(session.user.role as Role, "accounting:read");
  const filters = await listPreparedFilters();

  const exportQs = new URLSearchParams();
  exportQs.set("preset", preset);
  if (params.start) exportQs.set("start", params.start);
  if (params.end) exportQs.set("end", params.end);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Operational and financial reporting · company timezone from Settings"
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/exports?type=jobs&${exportQs}`}
              className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium leading-8 hover:bg-slate-50"
            >
              Export Jobs CSV
            </a>
            <a
              href={`/api/exports?type=trucks&${exportQs}`}
              className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium leading-8 hover:bg-slate-50"
            >
              Export Trucks CSV
            </a>
            {canFinance ? (
              <a
                href="/api/exports?type=ar-aging"
                className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium leading-8 hover:bg-slate-50"
              >
                Export AR Aging CSV
              </a>
            ) : null}
          </div>
        }
      />

      <form className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <label className="text-[11px] text-slate-500">
          Report
          <select
            name="report"
            defaultValue={report}
            className="mt-0.5 block h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            {REPORTS.map((r) => (
              <option key={r.id} value={r.id} disabled={r.id === "financial" && !canFinance}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-500">
          Date Range
          <select
            name="preset"
            defaultValue={preset}
            className="mt-0.5 block h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            {DATE_PRESET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-500">
          Start
          <input
            type="date"
            name="start"
            defaultValue={params.start ?? ""}
            className="mt-0.5 block h-9 rounded-md border border-slate-300 px-2 text-sm"
          />
        </label>
        <label className="text-[11px] text-slate-500">
          End
          <input
            type="date"
            name="end"
            defaultValue={params.end ?? ""}
            className="mt-0.5 block h-9 rounded-md border border-slate-300 px-2 text-sm"
          />
        </label>
        <button type="submit" className="h-9 rounded-md bg-slate-900 px-3 text-xs text-white">
          Run
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.id}
            href={f.href}
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 hover:bg-white"
          >
            {f.label}
          </Link>
        ))}
      </div>

      {report === "jobs_customer" ? <JobsByCustomer params={rangeParams} /> : null}
      {report === "jobs_status" ? <JobsByStatus params={rangeParams} /> : null}
      {report === "truck_movements" ? <TruckMovements params={rangeParams} /> : null}
      {report === "loads_carrier" ? <LoadsByCarrier params={rangeParams} /> : null}
      {report === "material" ? <MaterialReport params={rangeParams} /> : null}
      {report === "missing_trucks" ? <MissingTrucks /> : null}
      {report === "financial" && canFinance ? <FinancialReport params={rangeParams} /> : null}
      {report === "financial" && !canFinance ? (
        <EmptyState message="Financial reports require accounting permissions." />
      ) : null}
    </div>
  );
}

async function JobsByCustomer(props: {
  params: { preset?: string | null; start?: string | null; end?: string | null };
}) {
  const data = await reportJobsByCustomer(props.params);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">
        Jobs by Customer <span className="text-xs font-normal text-slate-500">({data.range.label})</span>
      </h2>
      {data.rows.length === 0 ? (
        <EmptyState message="No jobs in range." />
      ) : (
        <DataTable headers={["Customer", "Jobs", "Trucks Req", "Revenue", "Weight", "Footage"]}>
          {data.rows.map((r) => (
            <tr key={r.customerId} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">
                <Link href={`/customers/${r.customerId}`} className="text-blue-700 hover:underline">
                  {r.customerName}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums">{r.jobs}</td>
              <td className="px-3 py-2 tabular-nums">{r.trucksRequired}</td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(r.revenue.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums">{formatWeight(r.weightLbs.toString())}</td>
              <td className="px-3 py-2 tabular-nums">{formatFootage(r.footage.toString())}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}

async function JobsByStatus(props: {
  params: { preset?: string | null; start?: string | null; end?: string | null };
}) {
  const data = await reportJobsByStatus(props.params);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">
        Jobs by Status <span className="text-xs font-normal text-slate-500">({data.range.label})</span>
      </h2>
      <DataTable headers={["Status", "Count"]}>
        {data.rows.map((r) => (
          <tr key={r.status} className="border-t border-slate-100">
            <td className="px-3 py-2">
              <StatusBadge status={r.status} />
            </td>
            <td className="px-3 py-2 tabular-nums font-medium">{r.count}</td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

async function TruckMovements(props: {
  params: { preset?: string | null; start?: string | null; end?: string | null };
}) {
  const data = await reportTruckMovements(props.params);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">
        Truck Movements <span className="text-xs font-normal text-slate-500">({data.range.label})</span>
      </h2>
      {data.rows.length === 0 ? (
        <EmptyState message="No truck movements in range." />
      ) : (
        <DataTable
          headers={["Job", "Truck", "Customer", "Carrier", "Driver", "Equipment", "Status", "Weight"]}
        >
          {data.rows.map((t) => (
            <tr key={t.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <Link href={`/jobs/${t.job.id}`} className="text-blue-700 hover:underline">
                  {t.job.jobNumber}
                </Link>
              </td>
              <td className="px-3 py-2 font-medium">{t.displayId}</td>
              <td className="px-3 py-2">{t.job.customer.companyName}</td>
              <td className="px-3 py-2">{t.carrier?.legalName ?? "—"}</td>
              <td className="px-3 py-2">
                {t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : "—"}
              </td>
              <td className="px-3 py-2 text-xs">
                {[t.tractor?.unitNumber, t.trailer?.unitNumber].filter(Boolean).join(" / ") || "—"}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={t.status} />
              </td>
              <td className="px-3 py-2 tabular-nums">{formatWeight(t.totalWeightLbs.toString())}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}

async function LoadsByCarrier(props: {
  params: { preset?: string | null; start?: string | null; end?: string | null };
}) {
  const data = await reportLoadsByCarrier(props.params);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">
        Loads by Carrier <span className="text-xs font-normal text-slate-500">({data.range.label})</span>
      </h2>
      <DataTable headers={["Carrier", "Loads", "Cost", "Weight", "Footage"]}>
        {data.rows.map((r) => (
          <tr key={r.carrierId} className="border-t border-slate-100">
            <td className="px-3 py-2 font-medium">
              <Link href={`/carriers/${r.carrierId}`} className="text-blue-700 hover:underline">
                {r.carrierName}
              </Link>
            </td>
            <td className="px-3 py-2 tabular-nums">{r.loads}</td>
            <td className="px-3 py-2 tabular-nums">{formatCurrencyPrecise(r.cost.toString())}</td>
            <td className="px-3 py-2 tabular-nums">{formatWeight(r.weightLbs.toString())}</td>
            <td className="px-3 py-2 tabular-nums">{formatFootage(r.footage.toString())}</td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

async function MaterialReport(props: {
  params: { preset?: string | null; start?: string | null; end?: string | null };
}) {
  const data = await reportMaterialHauled(props.params);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">
        Material Hauled <span className="text-xs font-normal text-slate-500">({data.range.label})</span>
      </h2>
      <DataTable headers={["Category", "Description", "Items", "Footage", "Weight"]}>
        {data.rows.map((r) => (
          <tr key={`${r.category}-${r.description}`} className="border-t border-slate-100">
            <td className="px-3 py-2">{r.category}</td>
            <td className="px-3 py-2 font-medium">{r.description}</td>
            <td className="px-3 py-2 tabular-nums">{r.count}</td>
            <td className="px-3 py-2 tabular-nums">{formatFootage(r.footage.toString())}</td>
            <td className="px-3 py-2 tabular-nums">{formatWeight(r.weight.toString())}</td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

async function MissingTrucks() {
  const rows = await reportJobsMissingTrucks();
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Jobs Missing Trucks</h2>
      {rows.length === 0 ? (
        <EmptyState message="All active jobs have required trucks assigned." />
      ) : (
        <DataTable headers={["Job", "Customer", "Required", "Assigned", "Needed", "Pickup", "Status"]}>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">
                <Link href={`/jobs/${r.id}`} className="text-blue-700 hover:underline">
                  {r.jobNumber}
                </Link>
              </td>
              <td className="px-3 py-2">{r.customerName}</td>
              <td className="px-3 py-2 tabular-nums">{r.required}</td>
              <td className="px-3 py-2 tabular-nums">{r.assigned}</td>
              <td className="px-3 py-2 tabular-nums font-semibold text-amber-700">{r.needed}</td>
              <td className="px-3 py-2 tabular-nums">
                {r.pickupDate ? r.pickupDate.toISOString().slice(0, 10) : "—"}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}

async function FinancialReport(props: {
  params: { preset?: string | null; start?: string | null; end?: string | null };
}) {
  const data = await reportFinancialSummary(props.params);
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold">
        Financial Summary{" "}
        <span className="text-xs font-normal text-slate-500">({data.range.label})</span>
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="rounded border bg-white px-3 py-2">
          Revenue: {formatCurrencyPrecise(data.totals.revenue.toString())}
        </div>
        <div className="rounded border bg-white px-3 py-2">
          Gross Profit: {formatCurrencyPrecise(data.totals.profit.toString())}
        </div>
        <div className="rounded border bg-white px-3 py-2">
          Margin: {formatPercent(data.totals.marginPercent.toString())}
        </div>
        <div className="rounded border bg-white px-3 py-2">
          Outstanding AP: {formatCurrencyPrecise(data.totals.outstandingAp.toString())}
        </div>
        <div className="rounded border bg-white px-3 py-2">
          Acc Revenue: {formatCurrencyPrecise(data.totals.accessorialRevenue.toString())}
        </div>
        <div className="rounded border bg-white px-3 py-2">
          Acc Cost: {formatCurrencyPrecise(data.totals.accessorialCost.toString())}
        </div>
        <div className="rounded border bg-white px-3 py-2">
          AR Current: {formatCurrencyPrecise(data.arAging.current.toString())}
        </div>
        <div className="rounded border bg-white px-3 py-2">
          AR 90+: {formatCurrencyPrecise(data.arAging.d90plus.toString())}
        </div>
      </div>

      <h3 className="text-xs font-semibold uppercase text-slate-500">Revenue by Customer</h3>
      <DataTable headers={["Customer", "Jobs", "Revenue", "Cost", "Profit", "Margin"]}>
        {data.byCustomer.map((c) => (
          <tr key={c.customerId} className="border-t border-slate-100">
            <td className="px-3 py-2 font-medium">
              <Link href={`/customers/${c.customerId}`} className="text-blue-700 hover:underline">
                {c.name}
              </Link>
            </td>
            <td className="px-3 py-2 tabular-nums">{c.jobs}</td>
            <td className="px-3 py-2 tabular-nums">{formatCurrencyPrecise(c.revenue.toString())}</td>
            <td className="px-3 py-2 tabular-nums">{formatCurrencyPrecise(c.cost.toString())}</td>
            <td className="px-3 py-2 tabular-nums">{formatCurrencyPrecise(c.profit.toString())}</td>
            <td className="px-3 py-2 tabular-nums">{formatPercent(c.marginPercent.toString())}</td>
          </tr>
        ))}
      </DataTable>

      <h3 className="text-xs font-semibold uppercase text-slate-500">Revenue / Profit by Month</h3>
      <DataTable headers={["Month", "Revenue", "Gross Profit"]}>
        {data.byMonth.map((m) => (
          <tr key={m.month} className="border-t border-slate-100">
            <td className="px-3 py-2 font-medium">{m.month}</td>
            <td className="px-3 py-2 tabular-nums">{formatCurrencyPrecise(m.revenue.toString())}</td>
            <td className="px-3 py-2 tabular-nums">{formatCurrencyPrecise(m.profit.toString())}</td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}
