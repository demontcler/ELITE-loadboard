import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  FileWarning,
  Truck,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { summarizeTruckProgress, type TruckStatusLike } from "@/lib/calculations/job-status";

export default async function DashboardPage() {
  await requireSession();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [todayJobs, activeJobs, settings] = await Promise.all([
    prisma.job.findMany({
      where: {
        deletedAt: null,
        pickupDate: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ["CANCELLED", "DRAFT"] },
      },
      include: { trucks: { where: { deletedAt: null }, select: { status: true } } },
      take: 200,
    }),
    prisma.job.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["CANCELLED", "COMPLETED", "DRAFT"] },
      },
      include: { trucks: { where: { deletedAt: null }, select: { status: true } } },
      take: 300,
    }),
    prisma.companySettings.findFirst(),
  ]);

  let trucksNeeded = 0;
  let activeTrucks = 0;
  for (const job of activeJobs) {
    const progress = summarizeTruckProgress(
      job.trucksRequired,
      job.trucks.map((t) => t.status as TruckStatusLike)
    );
    trucksNeeded += progress.needed;
    activeTrucks += progress.dispatched;
  }

  const metrics = [
    {
      label: "Today's Jobs",
      value: String(todayJobs.length),
      href: "/load-board",
      icon: ClipboardList,
    },
    {
      label: "Active Trucks",
      value: String(activeTrucks),
      href: "/load-board",
      icon: Truck,
    },
    {
      label: "Trucks Needed",
      value: String(trucksNeeded),
      href: "/load-board?needsTrucks=1",
      icon: AlertTriangle,
    },
    {
      label: "Missing PODs",
      value: "—",
      href: "/documents",
      icon: FileWarning,
    },
    {
      label: "Revenue (Open Jobs)",
      value: "—",
      href: "/accounting",
      icon: DollarSign,
    },
    {
      label: "Gross Margin",
      value: "—",
      href: "/accounting",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Operations Dashboard</h1>
        <p className="text-sm text-slate-500">
          {settings?.companyName ?? "ELITE Logistics"} — oilfield · pipe · flatbed dispatch overview.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.label} href={m.href}>
              <Card className="transition-colors hover:border-slate-300 hover:bg-slate-50">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {m.label}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-slate-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums text-slate-900">
                    {m.value}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dispatcher focus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Use the <Link className="font-medium text-sky-700 hover:underline" href="/load-board">Load Board</Link> for Future / Today / Dispatched work.
            </li>
            <li>
              Open a job to manage independent truck assignments, cargo, and equipment.
            </li>
            <li>
              Search globally from the header for jobs, POs, carriers, drivers, and equipment.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
