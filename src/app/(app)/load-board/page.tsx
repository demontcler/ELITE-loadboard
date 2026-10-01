import Link from "next/link";
import {
  listJobs,
  listDispatchers,
} from "@/server/jobs";
import { listCustomers } from "@/server/customers";
import { listCarriers } from "@/server/carriers";
import { listDrivers } from "@/server/drivers";
import {
  resolveLoadBoardColumn,
  summarizeTruckProgress,
  type JobStatusLike,
  type TruckStatusLike,
} from "@/lib/calculations/job-status";
import { PageHeader, StatusBadge, EmptyState } from "@/components/shared/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { formatCurrency } from "@/lib/utils";

function JobCard({
  job,
}: {
  job: Awaited<ReturnType<typeof listJobs>>[number];
}) {
  const progress = summarizeTruckProgress(
    job.trucksRequired,
    job.trucks.map((t) => t.status as TruckStatusLike)
  );
  const routeFrom =
    job.pickupName ||
    [job.pickupCity, job.pickupState].filter(Boolean).join(", ") ||
    "Pickup TBD";
  const routeTo =
    job.deliveryName ||
    job.rigName ||
    [job.deliveryCity, job.deliveryState].filter(Boolean).join(", ") ||
    "Delivery TBD";

  const alerts: string[] = [];
  if (progress.needed > 0) alerts.push(`${progress.needed} trucks needed`);
  if (job.trucks.some((t) => t.weightWarning)) alerts.push("Overweight");

  return (
    <Link href={`/jobs/${job.id}`}>
      <Card className="transition-colors hover:border-slate-300 hover:bg-slate-50">
        <CardHeader className="space-y-1 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold">{job.jobNumber}</CardTitle>
            <StatusBadge status={job.status} />
          </div>
          <div className="text-xs font-medium text-slate-700">{job.customer.companyName}</div>
          {job.dispatcher ? (
            <div className="text-[11px] text-slate-500">
              Dispatcher: {job.dispatcher.firstName} {job.dispatcher.lastName}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-600">
          <div>
            <div className="font-medium text-slate-800">{routeFrom}</div>
            <div className="text-slate-400">↓</div>
            <div className="font-medium text-slate-800">{routeTo}</div>
          </div>
          <div className="rounded-md bg-slate-50 px-2 py-1.5 tabular-nums">
            <div className="font-semibold text-slate-800">
              {progress.required} TRUCKS
            </div>
            <div className="mt-0.5 grid grid-cols-2 gap-x-2 text-[11px]">
              <span>{progress.assigned} Assigned</span>
              <span>{progress.dispatched} Dispatched</span>
              <span>{progress.delivered} Delivered</span>
              <span className={progress.needed > 0 ? "font-semibold text-amber-700" : ""}>
                {progress.needed} Needed
              </span>
            </div>
          </div>
          <div className="flex justify-between tabular-nums">
            <span>
              {job.pickupDate
                ? job.pickupDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "No date"}
            </span>
            <span>Rev {formatCurrency(job.totalRevenue.toString())}</span>
          </div>
          {alerts.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {alerts.map((a) => (
                <Badge key={a} variant="warning">
                  {a}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

const JOB_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "NEEDS_TRUCKS",
  "PARTIALLY_ASSIGNED",
  "READY",
  "DISPATCHED",
  "PARTIALLY_DISPATCHED",
  "IN_TRANSIT",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

export default async function LoadBoardPage({
  searchParams,
}: {
  searchParams: Promise<{
    customerId?: string;
    status?: string;
    dispatcherId?: string;
    carrierId?: string;
    driverId?: string;
    dateFrom?: string;
    dateTo?: string;
    pickup?: string;
    delivery?: string;
    needsTrucks?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const filters = {
    q: params.q || undefined,
    customerId: params.customerId || undefined,
    status: params.status || undefined,
    dispatcherId: params.dispatcherId || undefined,
    carrierId: params.carrierId || undefined,
    driverId: params.driverId || undefined,
    pickupDateFrom: params.dateFrom || undefined,
    pickupDateTo: params.dateTo || undefined,
    pickupLocation: params.pickup || undefined,
    deliveryLocation: params.delivery || undefined,
    needsTrucks: params.needsTrucks === "1" || params.needsTrucks === "true",
  };

  const [jobs, customers, carriers, drivers, dispatchers] = await Promise.all([
    listJobs(filters),
    listCustomers(),
    listCarriers(),
    listDrivers(),
    listDispatchers(),
  ]);

  const now = new Date();
  const columns = {
    FUTURE: [] as typeof jobs,
    TODAY: [] as typeof jobs,
    DISPATCHED: [] as typeof jobs,
  };

  for (const job of jobs) {
    if (job.status === "CANCELLED" || job.status === "COMPLETED" || job.status === "DRAFT") {
      continue;
    }
    const col = resolveLoadBoardColumn(
      job.pickupDate,
      job.status as JobStatusLike,
      now
    );
    columns[col].push(job);
  }

  const hasFilters = Boolean(
    params.customerId ||
      params.status ||
      params.dispatcherId ||
      params.carrierId ||
      params.driverId ||
      params.dateFrom ||
      params.dateTo ||
      params.pickup ||
      params.delivery ||
      params.needsTrucks ||
      params.q
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Load Board"
        description="Operational home — Future · Today · Dispatched. Multi-truck jobs aggregate status from truck assignments."
        actions={
          <Can permission="jobs:write">
            <Link
              href="/jobs/new"
              className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Create Job
            </Link>
          </Can>
        }
      />

      <form className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Filters
        </div>
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search job #, PO, rig…"
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
          />
          <select
            name="customerId"
            defaultValue={params.customerId ?? ""}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select
            name="dispatcherId"
            defaultValue={params.dispatcherId ?? ""}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All dispatchers</option>
            {dispatchers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.lastName}, {d.firstName}
              </option>
            ))}
          </select>
          <select
            name="carrierId"
            defaultValue={params.carrierId ?? ""}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All carriers</option>
            {carriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.legalName}
              </option>
            ))}
          </select>
          <select
            name="driverId"
            defaultValue={params.driverId ?? ""}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.lastName}, {d.firstName}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="dateFrom"
            defaultValue={params.dateFrom ?? ""}
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
            aria-label="Pickup date from"
          />
          <input
            type="date"
            name="dateTo"
            defaultValue={params.dateTo ?? ""}
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
            aria-label="Pickup date to"
          />
          <input
            name="pickup"
            defaultValue={params.pickup ?? ""}
            placeholder="Pickup location"
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
          />
          <input
            name="delivery"
            defaultValue={params.delivery ?? ""}
            placeholder="Delivery location / rig"
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
          />
          <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="needsTrucks"
              value="1"
              defaultChecked={params.needsTrucks === "1"}
            />
            Jobs needing trucks
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            className="h-8 rounded-md bg-slate-900 px-3 text-xs font-medium text-white"
          >
            Apply Filters
          </button>
          <Link
            href="/load-board"
            className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium hover:bg-slate-50"
          >
            Clear filters
          </Link>
          {hasFilters ? (
            <span className="self-center text-xs text-slate-500">
              Showing {jobs.length} matching job{jobs.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </form>

      <div className="grid gap-4 xl:grid-cols-3">
        {(
          [
            {
              key: "FUTURE" as const,
              title: "Future Loads",
              description: "Scheduled after today",
              accent: "border-t-sky-500",
              items: columns.FUTURE,
            },
            {
              key: "TODAY" as const,
              title: "Today's Loads",
              description: "Current day / backlog — not fully dispatched",
              accent: "border-t-amber-500",
              items: columns.TODAY,
            },
            {
              key: "DISPATCHED" as const,
              title: "Dispatched Loads",
              description: "Trucks actively moving",
              accent: "border-t-emerald-500",
              items: columns.DISPATCHED,
            },
          ] as const
        ).map((col) => (
          <section
            key={col.key}
            className={`rounded-lg border border-slate-200 border-t-4 bg-white ${col.accent}`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{col.title}</h2>
                <p className="text-[11px] text-slate-500">{col.description}</p>
              </div>
              <Badge variant="default">{col.items.length}</Badge>
            </div>
            <div className="space-y-2 p-3">
              {col.items.length === 0 ? (
                <EmptyState
                  message={
                    hasFilters
                      ? "No loads match the current filters."
                      : "No loads in this column."
                  }
                />
              ) : (
                col.items.map((job) => <JobCard key={job.id} job={job} />)
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
