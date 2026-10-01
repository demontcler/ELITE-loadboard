import Link from "next/link";
import { notFound } from "next/navigation";
import { getDriver, updateDriver, softDeleteDriver } from "@/server/drivers";
import { listCarriers } from "@/server/carriers";
import { PageHeader, StatusBadge, EmptyState, DataTable } from "@/components/shared/page-chrome";
import { DedicatedEntityForm } from "@/components/forms/dedicated-entity-form";
import { Can } from "@/components/auth/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchiveButton } from "@/components/shared/archive-button";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { DRIVER_DOC_TYPES } from "@/lib/documents/types";
import { evaluateDocumentStatus } from "@/lib/calculations/compliance";
import { getDriverReporting } from "@/server/reports";

async function DriverReportCards({ driverId }: { driverId: string }) {
  const report = await getDriverReporting(driverId).catch(() => null);
  if (!report) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Reporting snapshot</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] uppercase text-slate-500">Assignments</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-semibold">{report.truckAssignments}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] uppercase text-slate-500">Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-semibold">{report.loadsCompleted}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] uppercase text-slate-500">Current</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-semibold">
            {report.currentAssignment ? (
              <Link
                href={`/jobs/${report.currentAssignment.jobId}`}
                className="text-blue-700 hover:underline"
              >
                {report.currentAssignment.jobNumber} / {report.currentAssignment.displayId}
              </Link>
            ) : (
              "—"
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] uppercase text-slate-500">Equipment</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-semibold">
            {report.currentAssignment
              ? [report.currentAssignment.tractor, report.currentAssignment.trailer]
                  .filter(Boolean)
                  .join(" / ") || "—"
              : "—"}
          </CardContent>
        </Card>
      </div>
      {report.documents.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {report.documents.map((d, i) => (
            <span key={`${d.documentType}-${i}`} className="rounded border px-2 py-1">
              {d.documentType}: {d.status}
              {d.expirationDate ? ` · exp ${d.expirationDate.toISOString().slice(0, 10)}` : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default async function DriverDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [driver, carriers] = await Promise.all([getDriver(id), listCarriers()]);
  if (!driver) notFound();

  const carrierOptions = [
    { value: "", label: "— None —" },
    ...carriers.map((c) => ({ value: c.id, label: c.legalName })),
  ];

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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={driver.status} />
            <Can permission="drivers:write">
              <Link
                href={`/drivers/${id}?edit=1`}
                className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium leading-8 hover:bg-slate-50"
              >
                Edit
              </Link>
              <ArchiveButton
                label="Archive"
                action={async () => {
                  "use server";
                  await softDeleteDriver(id);
                }}
              />
            </Can>
          </div>
        }
      />

      <Can permission="drivers:write">
        {sp.edit === "1" ? (
          <DedicatedEntityForm
            title="Edit Driver"
            submitLabel="Save Changes"
            redirectTo={`/drivers/${id}`}
            defaultValues={{
              firstName: driver.firstName,
              lastName: driver.lastName,
              phone: driver.phone ?? "",
              email: driver.email ?? "",
              carrierId: driver.carrierId ?? "",
              driverType: driver.driverType,
              status: driver.status,
              cdlNumber: driver.cdlNumber ?? "",
              cdlState: driver.cdlState ?? "",
              cdlClass: driver.cdlClass ?? "",
              cdlExpiration: driver.cdlExpiration
                ? driver.cdlExpiration.toISOString().slice(0, 10)
                : "",
              medicalCardExpiration: driver.medicalCardExpiration
                ? driver.medicalCardExpiration.toISOString().slice(0, 10)
                : "",
              twicNumber: driver.twicNumber ?? "",
              twicExpiration: driver.twicExpiration
                ? driver.twicExpiration.toISOString().slice(0, 10)
                : "",
              emergencyContactName: driver.emergencyContactName ?? "",
              emergencyContactPhone: driver.emergencyContactPhone ?? "",
              notes: driver.notes ?? "",
            }}
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
              return updateDriver(id, data);
            }}
          />
        ) : null}
      </Can>

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
          <CardContent className="whitespace-pre-wrap text-sm text-slate-600">
            {driver.notes || "No notes"}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recent Assignments</h2>
        {driver.assignments.length === 0 ? (
          <EmptyState message="No truck assignments linked to this driver." />
        ) : (
          <DataTable headers={["Job", "Truck", "Status", "Pickup"]}>
            {driver.assignments.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2">
                  <Link href={`/jobs/${t.job.id}`} className="font-medium hover:underline">
                    {t.job.jobNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">{t.displayId}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {t.pickupDate ? t.pickupDate.toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <DriverReportCards driverId={driver.id} />

      <DocumentsPanel
        ownerType="DRIVER"
        ownerId={driver.id}
        documents={driver.documents}
        documentTypes={[...DRIVER_DOC_TYPES]}
        title="Driver Compliance Documents"
      />
    </div>
  );
}
