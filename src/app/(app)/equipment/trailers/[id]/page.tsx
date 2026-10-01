import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrailer, updateTrailer, softDeleteTrailer } from "@/server/equipment";
import { listCarriers } from "@/server/carriers";
import { PageHeader, StatusBadge, EmptyState, DataTable } from "@/components/shared/page-chrome";
import { DedicatedEntityForm } from "@/components/forms/dedicated-entity-form";
import { Can } from "@/components/auth/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchiveButton } from "@/components/shared/archive-button";

export default async function TrailerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [trailer, carriers] = await Promise.all([getTrailer(id), listCarriers()]);
  if (!trailer) notFound();

  const carrierOptions = [
    { value: "", label: "— None —" },
    ...carriers.map((c) => ({ value: c.id, label: c.legalName })),
  ];

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/equipment" className="hover:underline">
          Equipment
        </Link>{" "}
        / Trailer {trailer.unitNumber}
      </div>

      <PageHeader
        title={`Trailer ${trailer.unitNumber}`}
        description={
          trailer.customType ||
          trailer.trailerType.replaceAll("_", " ") +
            (trailer.lengthFeet ? ` · ${trailer.lengthFeet} ft` : "")
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={trailer.status} />
            <Can permission="equipment:write">
              <Link
                href={`/equipment/trailers/${id}?edit=1`}
                className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium leading-8 hover:bg-slate-50"
              >
                Edit
              </Link>
              <ArchiveButton
                label="Deactivate"
                action={async () => {
                  "use server";
                  await softDeleteTrailer(id);
                }}
              />
            </Can>
          </div>
        }
      />

      <Can permission="equipment:write">
        {sp.edit === "1" ? (
          <DedicatedEntityForm
            title="Edit Trailer"
            submitLabel="Save Changes"
            redirectTo={`/equipment/trailers/${id}`}
            defaultValues={{
              unitNumber: trailer.unitNumber,
              vin: trailer.vin ?? "",
              licensePlate: trailer.licensePlate ?? "",
              licenseState: trailer.licenseState ?? "",
              trailerType: trailer.trailerType,
              customType: trailer.customType ?? "",
              lengthFeet: trailer.lengthFeet?.toString() ?? "",
              axles: trailer.axles?.toString() ?? "",
              maxPayloadLbs: trailer.maxPayloadLbs?.toString() ?? "",
              carrierId: trailer.carrierId ?? "",
              status: trailer.status,
              notes: trailer.notes ?? "",
            }}
            fields={[
              { name: "unitNumber", label: "Unit Number", required: true, section: "Identity" },
              { name: "vin", label: "VIN", section: "Identity" },
              { name: "licensePlate", label: "License Plate", section: "Identity" },
              { name: "licenseState", label: "State", section: "Identity" },
              {
                name: "trailerType",
                label: "Trailer Type",
                section: "Specs",
                options: [
                  { value: "FLATBED", label: "Flatbed" },
                  { value: "STEP_DECK", label: "Step Deck" },
                  { value: "DOUBLE_DROP", label: "Double Drop" },
                  { value: "RGN", label: "RGN" },
                  { value: "HOTSHOT", label: "Hotshot" },
                  { value: "PIPE_TRAILER", label: "Pipe Trailer" },
                  { value: "OTHER", label: "Other" },
                ],
              },
              { name: "customType", label: "Custom Type", section: "Specs" },
              { name: "lengthFeet", label: "Length (ft)", type: "number", section: "Specs" },
              { name: "axles", label: "Axles", type: "number", section: "Specs" },
              { name: "maxPayloadLbs", label: "Max Payload (lb)", type: "number", section: "Specs" },
              { name: "carrierId", label: "Carrier", section: "Assignment", options: carrierOptions },
              {
                name: "status",
                label: "Status",
                section: "Assignment",
                options: [
                  { value: "AVAILABLE", label: "Available" },
                  { value: "ASSIGNED", label: "Assigned" },
                  { value: "IN_TRANSIT", label: "In Transit" },
                  { value: "MAINTENANCE", label: "Maintenance" },
                  { value: "OUT_OF_SERVICE", label: "Out of Service" },
                ],
              },
              { name: "notes", label: "Notes", section: "Notes", fullWidth: true },
            ]}
            onSubmit={async (data) => {
              "use server";
              return updateTrailer(id, data);
            }}
          />
        ) : null}
      </Can>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>Unit #: {trailer.unitNumber}</div>
            <div>VIN: {trailer.vin ?? "—"}</div>
            <div>
              Plate: {trailer.licensePlate ?? "—"}
              {trailer.licenseState ? ` (${trailer.licenseState})` : ""}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Specs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>Type: {trailer.customType || trailer.trailerType.replaceAll("_", " ")}</div>
            <div>Length: {trailer.lengthFeet ? `${trailer.lengthFeet} ft` : "—"}</div>
            <div>Axles: {trailer.axles ?? "—"}</div>
            <div>
              Max payload:{" "}
              {trailer.maxPayloadLbs
                ? `${Number(trailer.maxPayloadLbs).toLocaleString()} lb`
                : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>Carrier: {trailer.carrier?.legalName ?? "—"}</div>
            <div className="whitespace-pre-wrap">Notes: {trailer.notes || "—"}</div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Documents</h2>
        {trailer.documents.length === 0 ? (
          <EmptyState message="Equipment documents will be managed in the Documents phase." />
        ) : (
          <DataTable headers={["Type", "File", "Expires"]}>
            {trailer.documents.map((doc) => (
              <tr key={doc.id}>
                <td className="px-3 py-2">{doc.documentType}</td>
                <td className="px-3 py-2">{doc.fileName}</td>
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
