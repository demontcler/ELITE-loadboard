import Link from "next/link";
import { listDrivers, createDriver } from "@/server/drivers";
import { listCarriers } from "@/server/carriers";
import { PageHeader, DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { CreateEntityForm } from "@/components/shared/create-entity-form";
import { evaluateDocumentStatus } from "@/lib/calculations/compliance";

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const [drivers, carriers] = await Promise.all([
    listDrivers(params.q),
    listCarriers(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Drivers"
        description="Company and carrier drivers — CDL, medical card, TWIC, and assignment status."
        actions={
          <CreateEntityForm
            title="New Driver"
            submitLabel="Add Driver"
            fields={[
              { name: "firstName", label: "First Name", required: true },
              { name: "lastName", label: "Last Name", required: true },
              { name: "phone", label: "Phone" },
              { name: "email", label: "Email", type: "email" },
              {
                name: "carrierId",
                label: "Carrier",
                options: [
                  { value: "", label: "— None —" },
                  ...carriers.map((c) => ({ value: c.id, label: c.legalName })),
                ],
              },
              {
                name: "driverType",
                label: "Driver Type",
                options: [
                  { value: "CARRIER", label: "Carrier" },
                  { value: "COMPANY", label: "Company" },
                  { value: "OWNER_OPERATOR", label: "Owner Operator" },
                  { value: "CONTRACTOR", label: "Contractor" },
                ],
              },
              { name: "cdlNumber", label: "CDL Number" },
              { name: "cdlState", label: "CDL State" },
              { name: "cdlClass", label: "CDL Class" },
              { name: "cdlExpiration", label: "CDL Expiration", type: "date" },
              { name: "medicalCardExpiration", label: "Medical Card Exp", type: "date" },
            ]}
            onSubmit={async (data) => {
              "use server";
              await createDriver(data);
            }}
          />
        }
      />

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search name, phone, CDL…"
          className="h-9 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <button className="h-9 rounded-md bg-slate-900 px-3 text-sm text-white" type="submit">
          Search
        </button>
      </form>

      {drivers.length === 0 ? (
        <EmptyState message="No drivers yet." />
      ) : (
        <DataTable headers={["Driver", "Carrier", "Phone", "CDL Exp", "Med Exp", "Status", ""]}>
          {drivers.map((d) => {
            const cdlStatus = evaluateDocumentStatus(d.cdlExpiration);
            const medStatus = evaluateDocumentStatus(d.medicalCardExpiration);
            return (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/drivers/${d.id}`} className="hover:underline">
                    {d.lastName}, {d.firstName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-600">{d.carrier?.legalName ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{d.phone ?? "—"}</td>
                <td className="px-3 py-2">
                  {d.cdlExpiration ? (
                    <span className="inline-flex items-center gap-2">
                      {d.cdlExpiration.toISOString().slice(0, 10)}
                      <StatusBadge status={cdlStatus} />
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  {d.medicalCardExpiration ? (
                    <span className="inline-flex items-center gap-2">
                      {d.medicalCardExpiration.toISOString().slice(0, 10)}
                      <StatusBadge status={medStatus} />
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={d.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/drivers/${d.id}`} className="text-xs font-medium text-sky-700 hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
