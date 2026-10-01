import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "default" | "info" | "purple"> = {
  ACTIVE: "success",
  AVAILABLE: "success",
  APPROVED: "success",
  PREFERRED: "purple",
  VALID: "success",
  PENDING: "warning",
  EXPIRES_SOON: "warning",
  ASSIGNED: "info",
  IN_TRANSIT: "info",
  INACTIVE: "default",
  RESTRICTED: "danger",
  ARCHIVED: "default",
  OUT_OF_SERVICE: "danger",
  MAINTENANCE: "warning",
  OFF_DUTY: "default",
  EXPIRED: "danger",
  MISSING: "danger",
  READY_TO_INVOICE: "success",
  READY_FOR_APPROVAL: "success",
  READY_FOR_PAYMENT: "success",
  SENT: "info",
  PAID: "success",
  PARTIALLY_PAID: "warning",
  PARTIAL_PAYMENT: "warning",
  NOT_READY: "danger",
  PAPERWORK_HOLD: "danger",
  OVERDUE: "danger",
  DISPUTED: "warning",
  VOID: "default",
  SCHEDULED: "info",
  DRAFT: "default",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "default"} className={cn(className)}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-10 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
