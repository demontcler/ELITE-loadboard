import Link from "next/link";
import { notFound } from "next/navigation";
import { getDriver } from "@/server/drivers";
import { PageHeader, StatusBadge, EmptyState, DataTable } from "@/components/shared/page-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { evaluateDocumentStatus } from "@/lib/calculations/compliance";

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const driver = await getDriver(id);
  if (!driver) notFound();

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/drivers" className="hover:underline">
          Drivers
        </Link>{" "}
        / {driver.firstName} {driver.lastName}
      </div>

      <PageHeader
        title={`${driver.firstName} ${driver.lastName}`}
        description={driver.carrier?.legalName ?? "Unassigned carrier"}
        actions={<StatusBadge status={driver.status} />}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>Phone: {driver.phone ?? "—"}</div>
            <div>Email: {driver.email ?? "—"}</div>
            <div>Type: {driver.driverType.replaceAll("_", " ")}</div>
            <div>
              Emergency: {driver.emergencyContactName ?? "—"}
              {driver.emergencyContactPhone ? ` · ${driver.emergencyContactPhone}` : ""}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <div>
              CDL: {driver.cdlNumber ?? "—"} ({driver.cdlClass ?? "?"} / {driver.cdlState ?? "?"})
            </div>
            <div className="flex items-center gap-2">
              CDL exp:{" "}
              {driver.cdlExpiration ? driver.cdlExpiration.toISOString().slice(0, 10) : "—"}
              {driver.cdlExpiration ? (
                <StatusBadge status={evaluateDocumentStatus(driver.cdlExpiration)} />
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              Medical:{" "}
              {driver.medicalCardExpiration
                ? driver.medicalCardExpiration.toISOString().slice(0, 10)
                : "—"}
              {driver.medicalCardExpiration ? (
                <StatusBadge status={evaluateDocumentStatus(driver.medicalCardExpiration)} />
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              TWIC: {driver.twicNumber ?? "—"}
              {driver.twicExpiration ? (
                <>
                  {" "}
                  / {driver.twicExpiration.toISOString().slice(0, 10)}
                  <StatusBadge status={evaluateDocumentStatus(driver.twicExpiration)} />
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 whitespace-pre-wrap">
            {driver.notes || "No notes"}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Documents</h2>
        {driver.documents.length === 0 ? (
          <EmptyState message="CDL, medical card, TWIC, and training uploads in Phase 5." />
        ) : (
          <DataTable headers={["Type", "File", "Status", "Expires"]}>
            {driver.documents.map((doc) => (
              <tr key={doc.id}>
                <td className="px-3 py-2">{doc.documentType}</td>
                <td className="px-3 py-2">{doc.fileName}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-3 py-2">
                  {doc.expirationDate ? doc.expirationDate.toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
