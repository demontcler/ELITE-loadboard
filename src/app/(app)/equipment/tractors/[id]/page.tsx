import Link from "next/link";
import { notFound } from "next/navigation";
import { getTractor, updateTractor, softDeleteTractor } from "@/server/equipment";
import { listCarriers } from "@/server/carriers";
import { PageHeader, StatusBadge, EmptyState, DataTable } from "@/components/shared/page-chrome";
import { DedicatedEntityForm } from "@/components/forms/dedicated-entity-form";
import { Can } from "@/components/auth/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchiveButton } from "@/components/shared/archive-button";

export default async function TractorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [tractor, carriers] = await Promise.all([getTractor(id), listCarriers()]);
  if (!tractor) notFound();

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
        / Tractor {tractor.unitNumber}
      </div>

      <PageHeader
        title={`Tractor ${tractor.unitNumber}`}
        description={[tractor.year, tractor.make, tractor.model].filter(Boolean).join(" ") || "Tractor"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={tractor.status} />
            <Can permission="equipment:write">
              <Link
                href={`/equipment/tractors/${id}?edit=1`}
                className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium leading-8 hover:bg-slate-50"
              >
                Edit
              </Link>
              <ArchiveButton
                label="Deactivate"
                action={async () => {
                  "use server";
                  await softDeleteTractor(id);
                }}
              />
            </Can>
          </div>
        }
      />

      <Can permission="equipment:write">
        {sp.edit === "1" ? (
          <DedicatedEntityForm
            title="Edit Tractor"
            submitLabel="Save Changes"
            redirectTo={`/equipment/tractors/${id}`}
            defaultValues={{
              unitNumber: tractor.unitNumber,
              vin: tractor.vin ?? "",
              licensePlate: tractor.licensePlate ?? "",
              licenseState: tractor.licenseState ?? "",
              year: tractor.year?.toString() ?? "",
              make: tractor.make ?? "",
              model: tractor.model ?? "",
              carrierId: tractor.carrierId ?? "",
              status: tractor.status,
              notes: tractor.notes ?? "",
            }}
            fields={[
              { name: "unitNumber", label: "Unit Number", required: true, section: "Identity" },
              { name: "vin", label: "VIN", section: "Identity" },
              { name: "licensePlate", label: "License Plate", section: "Identity" },
              { name: "licenseState", label: "State", section: "Identity" },
              { name: "year", label: "Year", type: "number", section: "Specs" },
              { name: "make", label: "Make", section: "Specs" },
              { name: "model", label: "Model", section: "Specs" },
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
              return updateTractor(id, data);
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
            <div>Unit #: {tractor.unitNumber}</div>
            <div>VIN: {tractor.vin ?? "—"}</div>
            <div>
              Plate: {tractor.licensePlate ?? "—"}
              {tractor.licenseState ? ` (${tractor.licenseState})` : ""}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Specs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>Year: {tractor.year ?? "—"}</div>
            <div>Make: {tractor.make ?? "—"}</div>
            <div>Model: {tractor.model ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>Carrier: {tractor.carrier?.legalName ?? "—"}</div>
            <div className="whitespace-pre-wrap">Notes: {tractor.notes || "—"}</div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Documents</h2>
        {tractor.documents.length === 0 ? (
          <EmptyState message="Equipment documents will be managed in the Documents phase." />
        ) : (
          <DataTable headers={["Type", "File", "Expires"]}>
            {tractor.documents.map((doc) => (
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
