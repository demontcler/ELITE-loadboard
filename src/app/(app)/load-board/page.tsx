import Link from "next/link";
import { listJobs } from "@/server/jobs";
import {
  resolveLoadBoardColumn,
  summarizeTruckProgress,
  type JobStatusLike,
  type TruckStatusLike,
} from "@/lib/calculations/job-status";
import { PageHeader, StatusBadge } from "@/components/shared/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-600">
          <div>
            <div className="font-medium text-slate-800">{routeFrom}</div>
            <div className="text-slate-400">↓</div>
            <div className="font-medium text-slate-800">{routeTo}</div>
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
            <span>
              {progress.required} req · {progress.assigned} asgn · {progress.dispatched} disp
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 tabular-nums">
            <span>Rev {formatCurrency(job.totalRevenue.toString())}</span>
            <span className="text-emerald-700">
              Mgn {formatCurrency(job.grossProfit.toString())}
            </span>
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

export default async function LoadBoardPage() {
  const jobs = await listJobs();
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Load Board"
        description="Operational home — Future · Today · Dispatched. Multi-truck jobs aggregate status from truck assignments."
        actions={
          <Link
            href="/jobs/new"
            className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create Job
          </Link>
        }
      />

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
          <section key={col.key} className={`rounded-lg border border-slate-200 border-t-4 bg-white ${col.accent}`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{col.title}</h2>
                <p className="text-[11px] text-slate-500">{col.description}</p>
              </div>
              <Badge variant="default">{col.items.length}</Badge>
            </div>
            <div className="space-y-2 p-3">
              {col.items.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-400">
                  No loads
                </div>
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
