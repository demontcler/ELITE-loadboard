import Link from "next/link";
import { notFound } from "next/navigation";
import { getCarrier } from "@/server/carriers";
import { PageHeader, StatusBadge, EmptyState, DataTable } from "@/components/shared/page-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CarrierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const carrier = await getCarrier(id);
  if (!carrier) notFound();

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/carriers" className="hover:underline">
          Carriers
        </Link>{" "}
        / {carrier.legalName}
      </div>

      <PageHeader
        title={carrier.legalName}
        description={carrier.dba ? `DBA ${carrier.dba}` : "Carrier profile"}
        actions={
          <div className="flex gap-2">
            <StatusBadge status={carrier.approvalStatus} />
            <StatusBadge status={carrier.status} />
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>MC: {carrier.mcNumber ?? "—"}</div>
            <div>USDOT: {carrier.usdotNumber ?? "—"}</div>
            <div>Tax ID: {carrier.taxId ?? "—"}</div>
            <div>Phone: {carrier.phone ?? "—"}</div>
            <div>Email: {carrier.email ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            <div>{carrier.address1 ?? "—"}</div>
            <div>
              {[carrier.city, carrier.state, carrier.zip].filter(Boolean).join(", ") || "—"}
            </div>
            <div className="mt-2">
              Terms: {carrier.paymentTerms.replaceAll("_", " ")}
            </div>
            <div>Pay method: {carrier.preferredPaymentMethod ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Safety</div>
              <div className="whitespace-pre-wrap">{carrier.safetyNotes || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Internal</div>
              <div className="whitespace-pre-wrap">{carrier.internalNotes || "—"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Drivers</h2>
        {carrier.drivers.length === 0 ? (
          <EmptyState message="No drivers linked to this carrier." />
        ) : (
          <DataTable headers={["Name", "Phone", "CDL", "Status"]}>
            {carrier.drivers.map((d) => (
              <tr key={d.id}>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/drivers/${d.id}`} className="hover:underline">
                    {d.lastName}, {d.firstName}
                  </Link>
                </td>
                <td className="px-3 py-2">{d.phone ?? "—"}</td>
                <td className="px-3 py-2">{d.cdlNumber ?? "—"}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={d.status} />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Equipment</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Tractors</h3>
            {carrier.tractors.length === 0 ? (
              <EmptyState message="No tractors." />
            ) : (
              <DataTable headers={["Unit", "Year/Make", "Plate", "Status"]}>
                {carrier.tractors.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-medium">{t.unitNumber}</td>
                    <td className="px-3 py-2">
                      {[t.year, t.make, t.model].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-3 py-2">{t.licensePlate ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Trailers</h3>
            {carrier.trailers.length === 0 ? (
              <EmptyState message="No trailers." />
            ) : (
              <DataTable headers={["Unit", "Type", "Payload", "Status"]}>
                {carrier.trailers.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-medium">{t.unitNumber}</td>
                    <td className="px-3 py-2">
                      {t.customType || t.trailerType.replaceAll("_", " ")}
                    </td>
                    <td className="px-3 py-2">
                      {t.maxPayloadLbs ? `${t.maxPayloadLbs.toString()} lb` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Compliance documents</h2>
        {carrier.documents.length === 0 ? (
          <EmptyState message="COI, W-9, authority, and agreements upload in Phase 5." />
        ) : (
          <DataTable headers={["Type", "File", "Status", "Expires"]}>
            {carrier.documents.map((doc) => (
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
