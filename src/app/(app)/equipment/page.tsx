import Link from "next/link";
import {
  listTractors,
  listTrailers,
  createTractor,
  createTrailer,
} from "@/server/equipment";
import { listCarriers } from "@/server/carriers";
import { PageHeader, DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { DedicatedEntityForm } from "@/components/forms/dedicated-entity-form";
import { Can } from "@/components/auth/can";
import { CreateToggle } from "@/components/shared/create-toggle";

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  const params = await searchParams;
  const [tractors, trailers, carriers] = await Promise.all([
    listTractors(),
    listTrailers(),
    listCarriers(),
  ]);

  const carrierOptions = [
    { value: "", label: "— None —" },
    ...carriers.map((c) => ({ value: c.id, label: c.legalName })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment"
        description="Tractors and trailers — flatbed, step deck, RGN, pipe trailer, payload limits."
        actions={
          <Can permission="equipment:write">
            <div className="flex gap-2">
              <CreateToggle href="/equipment?create=tractor" label="Add Tractor" />
              <CreateToggle href="/equipment?create=trailer" label="Add Trailer" />
            </div>
          </Can>
        }
      />

      <Can permission="equipment:write">
        {params.create === "tractor" ? (
          <DedicatedEntityForm
            title="New Tractor"
            submitLabel="Create Tractor"
            redirectBasePath="/equipment/tractors"
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
              return createTractor(data);
            }}
          />
        ) : null}
        {params.create === "trailer" ? (
          <DedicatedEntityForm
            title="New Trailer"
            submitLabel="Create Trailer"
            redirectBasePath="/equipment/trailers"
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
              return createTrailer(data);
            }}
          />
        ) : null}
      </Can>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Tractors</h2>
        {tractors.length === 0 ? (
          <EmptyState message="No tractors yet." />
        ) : (
          <DataTable headers={["Unit", "Carrier", "Year/Make/Model", "Plate", "Status", ""]}>
            {tractors.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/equipment/tractors/${t.id}`} className="hover:underline">
                    {t.unitNumber}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-600">{t.carrier?.legalName ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">
                  {[t.year, t.make, t.model].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {t.licensePlate ?? "—"}
                  {t.licenseState ? ` (${t.licenseState})` : ""}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/equipment/tractors/${t.id}`}
                    className="text-xs font-medium text-sky-700 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Trailers</h2>
        {trailers.length === 0 ? (
          <EmptyState message="No trailers yet." />
        ) : (
          <DataTable headers={["Unit", "Carrier", "Type", "Length", "Payload", "Status", ""]}>
            {trailers.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/equipment/trailers/${t.id}`} className="hover:underline">
                    {t.unitNumber}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-600">{t.carrier?.legalName ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">
                  {t.customType || t.trailerType.replaceAll("_", " ")}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {t.lengthFeet ? `${t.lengthFeet.toString()} ft` : "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {t.maxPayloadLbs ? `${Number(t.maxPayloadLbs).toLocaleString()} lb` : "—"}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/equipment/trailers/${t.id}`}
                    className="text-xs font-medium text-sky-700 hover:underline"
                  >
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
