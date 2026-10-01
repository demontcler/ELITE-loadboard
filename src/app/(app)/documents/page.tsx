import Link from "next/link";
import { listComplianceCenter } from "@/server/compliance";
import { PageHeader, StatusBadge, EmptyState, DataTable } from "@/components/shared/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    entityType?: string;
    documentType?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const { rows, missingAlerts, counts, expiresSoonDays } = await listComplianceCenter({
    entityType: params.entityType || undefined,
    documentType: params.documentType || undefined,
    status: params.status || undefined,
    q: params.q || undefined,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Documents / Compliance"
        description={`Central compliance view. Expiring-soon window: ${expiresSoonDays} days (Settings).`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase text-slate-500">Expired</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-red-700">{counts.expired}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase text-slate-500">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-amber-700">
            {counts.expiringSoon}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase text-slate-500">Missing Required</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-red-700">{counts.missing}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase text-slate-500">Valid Current</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-700">{counts.valid}</CardContent>
        </Card>
      </div>

      <form className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-4">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search owner, type, filename…"
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
          />
          <select
            name="entityType"
            defaultValue={params.entityType ?? ""}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All entities</option>
            <option value="CUSTOMER">Customer</option>
            <option value="CARRIER">Carrier</option>
            <option value="DRIVER">Driver</option>
            <option value="EQUIPMENT">Equipment</option>
            <option value="TRUCK_ASSIGNMENT">Truck Assignment</option>
          </select>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="EXPIRED">Expired</option>
            <option value="EXPIRES_SOON">Expiring Soon</option>
            <option value="VALID">Valid</option>
            <option value="MISSING">Missing</option>
          </select>
          <input
            name="documentType"
            defaultValue={params.documentType ?? ""}
            placeholder="Document type (BOL, COI…)"
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <button type="submit" className="h-8 rounded-md bg-slate-900 px-3 text-xs text-white">
            Apply
          </button>
          <Link
            href="/documents"
            className="inline-flex h-8 items-center rounded-md border border-slate-300 px-3 text-xs"
          >
            Clear
          </Link>
        </div>
      </form>

      {missingAlerts.length > 0 && (!params.status || params.status === "MISSING") ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Missing Required Documents</h2>
          <DataTable headers={["Entity", "Owner", "Document", ""]}>
            {missingAlerts.map((a, idx) => (
              <tr key={`${a.entityId}-${a.documentType}-${idx}`}>
                <td className="px-3 py-2">{a.entityType}</td>
                <td className="px-3 py-2 font-medium">{a.entityLabel}</td>
                <td className="px-3 py-2">
                  <Badge variant="danger">{a.message}</Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={
                      a.entityType === "CARRIER"
                        ? `/carriers/${a.entityId}`
                        : a.entityType === "DRIVER"
                          ? `/drivers/${a.entityId}`
                          : "#"
                    }
                    className="text-xs text-sky-700 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Current Documents</h2>
        {rows.length === 0 ? (
          <EmptyState message="No documents match the current filters." />
        ) : (
          <DataTable headers={["Owner Type", "Owner", "Type", "File", "Status", "Expires", ""]}>
            {rows.map((r) => (
              <tr key={`${r.ownerType}-${r.id}`}>
                <td className="px-3 py-2 text-xs uppercase text-slate-500">{r.ownerType}</td>
                <td className="px-3 py-2 font-medium">{r.ownerLabel}</td>
                <td className="px-3 py-2">{r.documentType.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{r.fileName}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2">
                  {r.expirationDate ? r.expirationDate.toISOString().slice(0, 10) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={r.href} className="text-xs text-sky-700 hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
