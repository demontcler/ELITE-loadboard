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
import { Badge } from "@/components/ui/badge";

const METRICS = [
  { label: "Today's Jobs", value: "—", href: "/load-board?column=today", icon: ClipboardList },
  { label: "Active Trucks", value: "—", href: "/load-board?column=dispatched", icon: Truck },
  { label: "Trucks Needed", value: "—", href: "/load-board?filter=needs-trucks", icon: AlertTriangle },
  { label: "Missing PODs", value: "—", href: "/documents?filter=missing-pod", icon: FileWarning },
  { label: "Revenue (Week)", value: "—", href: "/accounting", icon: DollarSign },
  { label: "Gross Margin", value: "—", href: "/accounting", icon: TrendingUp },
];

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Operations Dashboard</h1>
          <p className="text-sm text-slate-500">
            Oilfield · pipe · flatbed dispatch overview. Metrics populate as jobs are created.
          </p>
        </div>
        <Badge variant="info">Phase 1</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {METRICS.map((m) => {
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
          <CardTitle>System ready</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>
            Foundation is in place: authentication, RBAC, PostgreSQL schema, calculation
            utilities, and the operations shell.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Core model: Customer → Job → Truck Assignments → Cargo Items</li>
            <li>Each truck is an independent assignment with its own cargo, docs, and costs</li>
            <li>Next: Phase 2 master data (Customers, Carriers, Drivers, Equipment)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
