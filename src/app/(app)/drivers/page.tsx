import Link from "next/link";
import { listDrivers, createDriver } from "@/server/drivers";
import { listCarriers } from "@/server/carriers";
import { PageHeader, DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { DedicatedEntityForm } from "@/components/forms/dedicated-entity-form";
import { Can } from "@/components/auth/can";
import { CreateToggle } from "@/components/shared/create-toggle";
import { evaluateDocumentStatus } from "@/lib/calculations/compliance";

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; create?: string }>;
}) {
  const params = await searchParams;
  const [drivers, carriers] = await Promise.all([
    listDrivers(params.q),
    listCarriers(),
  ]);

  const carrierOptions = [
    { value: "", label: "— None —" },
    ...carriers.map((c) => ({ value: c.id, label: c.legalName })),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Drivers"
        description="Company and carrier drivers — CDL, medical card, TWIC, and assignment status."
        actions={
          <Can permission="drivers:write">
            <CreateToggle href="/drivers?create=1" label="Add Driver" />
          </Can>
        }
      />

      <Can permission="drivers:write">
        {params.create === "1" ? (
          <DedicatedEntityForm
            title="New Driver"
            submitLabel="Create Driver"
            redirectBasePath="/drivers"
            fields={[
              { name: "firstName", label: "First Name", required: true, section: "Personal" },
              { name: "lastName", label: "Last Name", required: true, section: "Personal" },
              { name: "phone", label: "Phone", section: "Personal" },
              { name: "email", label: "Email", type: "email", section: "Personal" },
              {
                name: "carrierId",
                label: "Carrier",
                section: "Relationship",
                options: carrierOptions,
              },
              {
                name: "driverType",
                label: "Driver Type",
                section: "Relationship",
                options: [
                  { value: "CARRIER", label: "Carrier" },
                  { value: "COMPANY", label: "Company" },
                  { value: "OWNER_OPERATOR", label: "Owner Operator" },
                  { value: "CONTRACTOR", label: "Contractor" },
                ],
              },
              {
                name: "status",
                label: "Status",
                section: "Relationship",
                options: [
                  { value: "AVAILABLE", label: "Available" },
                  { value: "ASSIGNED", label: "Assigned" },
                  { value: "IN_TRANSIT", label: "In Transit" },
                  { value: "OFF_DUTY", label: "Off Duty" },
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "OUT_OF_SERVICE", label: "Out of Service" },
                ],
              },
              { name: "cdlNumber", label: "CDL Number", section: "CDL" },
              { name: "cdlState", label: "CDL State", section: "CDL" },
              { name: "cdlClass", label: "CDL Class", section: "CDL" },
              { name: "cdlExpiration", label: "CDL Expiration", type: "date", section: "CDL" },
              {
                name: "medicalCardExpiration",
                label: "Medical Card Exp",
                type: "date",
                section: "CDL",
              },
              { name: "twicNumber", label: "TWIC Number", section: "Credentials" },
              { name: "twicExpiration", label: "TWIC Expiration", type: "date", section: "Credentials" },
              { name: "emergencyContactName", label: "Emergency Contact", section: "Emergency" },
              { name: "emergencyContactPhone", label: "Emergency Phone", section: "Emergency" },
              { name: "notes", label: "Notes", section: "Notes", fullWidth: true },
            ]}
            onSubmit={async (data) => {
              "use server";
              return createDriver(data);
            }}
          />
        ) : null}
      </Can>

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
