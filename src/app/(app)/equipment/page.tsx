import { listTractors, listTrailers, createTractor, createTrailer } from "@/server/equipment";
import { listCarriers } from "@/server/carriers";
import { PageHeader, DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { CreateEntityForm } from "@/components/shared/create-entity-form";

export default async function EquipmentPage() {
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
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Tractors</h2>
          <CreateEntityForm
            title="New Tractor"
            submitLabel="Add Tractor"
            fields={[
              { name: "unitNumber", label: "Unit Number", required: true },
              { name: "vin", label: "VIN" },
              { name: "licensePlate", label: "License Plate" },
              { name: "licenseState", label: "State" },
              { name: "year", label: "Year", type: "number" },
              { name: "make", label: "Make" },
              { name: "model", label: "Model" },
              { name: "carrierId", label: "Carrier", options: carrierOptions },
            ]}
            onSubmit={async (data) => {
              "use server";
              await createTractor(data);
            }}
          />
        </div>
        {tractors.length === 0 ? (
          <EmptyState message="No tractors yet." />
        ) : (
          <DataTable headers={["Unit", "Carrier", "Year/Make/Model", "Plate", "Status"]}>
            {tractors.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-medium">{t.unitNumber}</td>
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
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Trailers</h2>
          <CreateEntityForm
            title="New Trailer"
            submitLabel="Add Trailer"
            fields={[
              { name: "unitNumber", label: "Unit Number", required: true },
              {
                name: "trailerType",
                label: "Trailer Type",
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
              { name: "customType", label: "Custom Type" },
              { name: "lengthFeet", label: "Length (ft)", type: "number" },
              { name: "axles", label: "Axles", type: "number" },
              { name: "maxPayloadLbs", label: "Max Payload (lb)", type: "number" },
              { name: "licensePlate", label: "License Plate" },
              { name: "licenseState", label: "State" },
              { name: "vin", label: "VIN" },
              { name: "carrierId", label: "Carrier", options: carrierOptions },
            ]}
            onSubmit={async (data) => {
              "use server";
              await createTrailer(data);
            }}
          />
        </div>
        {trailers.length === 0 ? (
          <EmptyState message="No trailers yet." />
        ) : (
          <DataTable headers={["Unit", "Carrier", "Type", "Length", "Payload", "Status"]}>
            {trailers.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-medium">{t.unitNumber}</td>
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
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
