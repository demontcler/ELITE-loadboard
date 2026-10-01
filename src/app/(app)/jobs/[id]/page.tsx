import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getJob,
  addTruckAssignments,
  addCargoItem,
  updateTruckAssignment,
  duplicateTruckAssignment,
  removeTruckAssignment,
  removeCargoItem,
  bulkUpdateTrucks,
  softDeleteJob,
} from "@/server/jobs";
import { listCarriers } from "@/server/carriers";
import { listDrivers } from "@/server/drivers";
import { listTractors, listTrailers } from "@/server/equipment";
import { getJobPaperwork, archiveDocument } from "@/server/documents";
import { PageHeader, StatusBadge, EmptyState, DataTable } from "@/components/shared/page-chrome";
import { DedicatedEntityForm } from "@/components/forms/dedicated-entity-form";
import { AssignTruckForm } from "@/components/jobs/assign-truck-form";
import { BulkTruckActions } from "@/components/jobs/bulk-truck-actions";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { DispatchComplianceWarnings } from "@/components/jobs/dispatch-compliance-warnings";
import { Can } from "@/components/auth/can";
import { ArchiveButton } from "@/components/shared/archive-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatWeight, formatFootage, formatPercent } from "@/lib/utils";
import { summarizeTruckProgress, type TruckStatusLike } from "@/lib/calculations/job-status";
import { OPERATIONAL_DOC_TYPES } from "@/lib/documents/types";
import { getSecureDocumentUrl } from "@/lib/storage";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [job, carriers, drivers, tractors, trailers, paperwork] = await Promise.all([
    getJob(id),
    listCarriers(),
    listDrivers(),
    listTractors(),
    listTrailers(),
    getJobPaperwork(id).catch(() => null),
  ]);
  if (!job) notFound();

  const paperworkByTruck = new Map(
    (paperwork?.trucks ?? []).map((t) => [t.truckAssignmentId, t])
  );

  const progress = summarizeTruckProgress(
    job.trucksRequired,
    job.trucks.map((t) => t.status as TruckStatusLike)
  );

  const routeFrom =
    job.pickupName ||
    [job.pickupCity, job.pickupState].filter(Boolean).join(", ") ||
    "Pickup TBD";
  const routeTo =
    job.deliveryName ||
    job.rigName ||
    [job.deliveryCity, job.deliveryState].filter(Boolean).join(", ") ||
    "Delivery TBD";

  const carrierOptions = [
    { value: "", label: "— Select —", carrierId: null as string | null },
    ...carriers.map((c) => ({ value: c.id, label: c.legalName, carrierId: c.id })),
  ];
  const driverOptions = [
    { value: "", label: "— Select —", carrierId: null as string | null },
    ...drivers.map((d) => ({
      value: d.id,
      label: `${d.lastName}, ${d.firstName}${d.carrier ? ` (${d.carrier.legalName})` : ""}`,
      carrierId: d.carrierId,
    })),
  ];
  const tractorOptions = [
    { value: "", label: "— Select —", carrierId: null as string | null },
    ...tractors.map((t) => ({
      value: t.id,
      label: [t.unitNumber, t.make, t.model].filter(Boolean).join(" / "),
      carrierId: t.carrierId,
    })),
  ];
  const trailerOptions = [
    { value: "", label: "— Select —", carrierId: null as string | null },
    ...trailers.map((t) => ({
      value: t.id,
      label: [
        t.unitNumber,
        t.customType || t.trailerType.replaceAll("_", " "),
        t.lengthFeet ? `${t.lengthFeet} ft` : null,
      ]
        .filter(Boolean)
        .join(" / "),
      carrierId: t.carrierId,
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        <Link href="/load-board" className="hover:underline">
          Load Board
        </Link>{" "}
        / {job.jobNumber}
      </div>

      <PageHeader
        title={job.jobNumber}
        description={`${job.customer.companyName} · ${routeFrom} → ${routeTo}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={job.status} />
            <Badge variant="info">
              {progress.assigned}/{progress.required} assigned · {progress.needed} needed
            </Badge>
            <Can permission="jobs:write">
              <ArchiveButton
                label="Archive Job"
                action={async () => {
                  "use server";
                  await softDeleteJob(id);
                }}
              />
            </Can>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase text-slate-500">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div>
              Pickup: {job.pickupDate ? job.pickupDate.toISOString().slice(0, 10) : "—"}
              {job.pickupTime ? ` ${job.pickupTime}` : ""}
            </div>
            <div>
              Delivery: {job.deliveryDate ? job.deliveryDate.toISOString().slice(0, 10) : "—"}
              {job.deliveryTime ? ` ${job.deliveryTime}` : ""}
            </div>
            <div className="mt-1 text-slate-500">
              {[job.rigName, job.leaseName, job.wellName].filter(Boolean).join(" · ") || "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase text-slate-500">Trucks</CardTitle>
          </CardHeader>
          <CardContent className="text-sm tabular-nums">
            <div>{progress.required} required</div>
            <div>{progress.assigned} assigned</div>
            <div>{progress.dispatched} dispatched</div>
            <div>{progress.delivered} delivered</div>
            {progress.needed > 0 ? (
              <div className="mt-1 font-semibold text-amber-700">{progress.needed} still needed</div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase text-slate-500">Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-sm tabular-nums">
            <div className="text-lg font-semibold">{formatCurrency(job.totalRevenue.toString())}</div>
            <div className="text-slate-500">
              {job.customerRate
                ? `Parent rate ${formatCurrency(job.customerRate.toString())} (authoritative)`
                : "Derived from truck allocations"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase text-slate-500">Margin</CardTitle>
          </CardHeader>
          <CardContent className="text-sm tabular-nums">
            <div className="text-lg font-semibold">{formatCurrency(job.grossProfit.toString())}</div>
            <div className="text-slate-500">
              Cost {formatCurrency(job.totalCost.toString())} · {formatPercent(job.marginPercent.toString())}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase text-slate-500">Paperwork</CardTitle>
          </CardHeader>
          <CardContent className="text-sm tabular-nums">
            {paperwork ? (
              <>
                <div>
                  {paperwork.job.bolsReceived}/{paperwork.job.trucksTotal} BOLs
                </div>
                <div>
                  {paperwork.job.podsReceived}/{paperwork.job.trucksTotal} PODs
                </div>
                <div>
                  {paperwork.job.paperworkComplete}/{paperwork.job.trucksTotal} complete
                </div>
                {paperwork.job.trucksMissingPod > 0 ? (
                  <div className="mt-1 font-semibold text-amber-700">
                    {paperwork.job.trucksMissingPod} missing POD
                  </div>
                ) : (
                  <div className="mt-1 font-semibold text-emerald-700">Paperwork complete</div>
                )}
              </>
            ) : (
              <div className="text-slate-500">—</div>
            )}
          </CardContent>
        </Card>
      </div>

      {(job.specialInstructions || job.pickupDirections || job.deliveryDirections) && (
        <Card>
          <CardHeader>
            <CardTitle>Instructions & directions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Special</div>
              <div className="whitespace-pre-wrap">{job.specialInstructions || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Pickup</div>
              <div className="whitespace-pre-wrap">{job.pickupDirections || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Delivery</div>
              <div className="whitespace-pre-wrap">{job.deliveryDirections || "—"}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Truck Assignments</h2>
          <Can permission="jobs:write">
            <form
              action={async () => {
                "use server";
                await addTruckAssignments(job.id, 1);
              }}
            >
              <button
                type="submit"
                className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium hover:bg-slate-50"
              >
                Add Truck
              </button>
            </form>
          </Can>
        </div>

        <Can permission="jobs:write">
          <BulkTruckActions
            trucks={job.trucks.map((t) => ({ id: t.id, displayId: t.displayId }))}
            carriers={carriers.map((c) => ({ id: c.id, legalName: c.legalName }))}
            onBulk={async (payload) => {
              "use server";
              await bulkUpdateTrucks(payload);
            }}
          />
        </Can>

        {job.trucks.length === 0 ? (
          <EmptyState message="No truck assignments." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Truck #</th>
                  <th className="px-3 py-2">Driver</th>
                  <th className="px-3 py-2">Carrier</th>
                  <th className="px-3 py-2">Tractor</th>
                  <th className="px-3 py-2">Trailer</th>
                  <th className="px-3 py-2">BOL</th>
                  <th className="px-3 py-2">POD</th>
                  <th className="px-3 py-2">Paperwork</th>
                  <th className="px-3 py-2">Weight</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {job.trucks.map((truck) => {
                  const pw = paperworkByTruck.get(truck.id);
                  const tractorLabel = truck.tractor
                    ? [truck.tractor.unitNumber, truck.tractor.make, truck.tractor.model]
                        .filter(Boolean)
                        .join(" / ")
                    : null;
                  const trailerLabel = truck.trailer
                    ? [
                        truck.trailer.unitNumber,
                        truck.trailer.customType ||
                          truck.trailer.trailerType.replaceAll("_", " "),
                        truck.trailer.lengthFeet ? `${truck.trailer.lengthFeet} ft` : null,
                      ]
                        .filter(Boolean)
                        .join(" / ")
                    : truck.trailerType?.replaceAll("_", " ") ?? null;
                  const flags: { label: string; variant: "danger" | "warning" | "default" | "info" | "success" }[] =
                    [];
                  if (truck.status === "UNASSIGNED")
                    flags.push({ label: "UNASSIGNED", variant: "default" });
                  if (["DISPATCHED", "IN_TRANSIT", "LOADED"].includes(truck.status))
                    flags.push({ label: "DISPATCHED", variant: "info" });
                  if (["DELIVERED", "POD_RECEIVED", "COMPLETED"].includes(truck.status))
                    flags.push({ label: "DELIVERED", variant: "success" });
                  if (!truck.driverId) flags.push({ label: "NEEDS DRIVER", variant: "danger" });
                  if (!truck.carrierId) flags.push({ label: "NEEDS CARRIER", variant: "warning" });
                  if (!truck.tractorId || !truck.trailerId)
                    flags.push({ label: "NEEDS EQUIPMENT", variant: "warning" });
                  if (truck.weightWarning)
                    flags.push({ label: "OVER WEIGHT THRESHOLD", variant: "warning" });
                  if (pw && !pw.pod) flags.push({ label: "MISSING POD", variant: "danger" });

                  return (
                    <tr key={truck.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-3" colSpan={10}>
                        <details className="group">
                          <summary className="cursor-pointer list-none">
                            <div className="grid grid-cols-1 gap-2 lg:grid-cols-10 lg:items-start">
                              <div>
                                <div className="font-semibold text-slate-900">{truck.displayId}</div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {flags.map((f) => (
                                    <Badge key={f.label} variant={f.variant}>
                                      {f.label}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="text-slate-700">
                                {truck.driver
                                  ? `${truck.driver.firstName} ${truck.driver.lastName}`
                                  : "—"}
                              </div>
                              <div className="text-slate-700">{truck.carrier?.legalName ?? "—"}</div>
                              <div className="text-slate-700">{tractorLabel ?? "—"}</div>
                              <div className="text-slate-700">{trailerLabel ?? "—"}</div>
                              <div className="font-semibold">{pw?.bol ? "✓" : "✕"}</div>
                              <div className="font-semibold">{pw?.pod ? "✓" : "✕"}</div>
                              <div>
                                <Badge variant={pw?.complete ? "success" : "warning"}>
                                  {pw?.statusLabel ?? "—"}
                                </Badge>
                              </div>
                              <div className="tabular-nums">
                                {formatWeight(truck.totalWeightLbs.toString())}
                              </div>
                              <div>
                                <StatusBadge status={truck.status} />
                              </div>
                            </div>
                          </summary>

                          <div className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                            <DispatchComplianceWarnings
                              carrierId={truck.carrierId}
                              driverId={truck.driverId}
                              tractorId={truck.tractorId}
                              trailerId={truck.trailerId}
                            />
                            <Can permission="jobs:write">
                              <div className="flex flex-wrap gap-2">
                                <AssignTruckForm
                                  title={`Assign ${truck.displayId}`}
                                  carriers={carrierOptions}
                                  drivers={driverOptions}
                                  tractors={tractorOptions}
                                  trailers={trailerOptions}
                                  defaultValues={{
                                    carrierId: truck.carrierId ?? "",
                                    driverId: truck.driverId ?? "",
                                    driverPhone: truck.driverPhone ?? "",
                                    tractorId: truck.tractorId ?? "",
                                    trailerId: truck.trailerId ?? "",
                                    trailerType: truck.trailerType ?? "",
                                    pickupDate: truck.pickupDate
                                      ? truck.pickupDate.toISOString().slice(0, 10)
                                      : "",
                                    pickupTime: truck.pickupTime ?? "",
                                    carrierRate: truck.carrierRate?.toString() ?? "",
                                    revenueAllocation: truck.revenueAllocation?.toString() ?? "",
                                    status: truck.status,
                                    notes: truck.notes ?? "",
                                  }}
                                  onSubmit={async (data) => {
                                    "use server";
                                    await updateTruckAssignment(truck.id, data);
                                  }}
                                />
                                <form
                                  action={async () => {
                                    "use server";
                                    await duplicateTruckAssignment(truck.id);
                                  }}
                                >
                                  <button
                                    type="submit"
                                    className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium hover:bg-slate-50"
                                  >
                                    Duplicate
                                  </button>
                                </form>
                                <form
                                  action={async () => {
                                    "use server";
                                    await removeTruckAssignment(truck.id);
                                  }}
                                >
                                  <button
                                    type="submit"
                                    className="h-8 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                                  >
                                    Remove
                                  </button>
                                </form>
                              </div>
                            </Can>

                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Documents (truck-specific)
                                </h3>
                                <Can permission="documents:write">
                                  <DocumentUploadForm
                                    ownerType="TRUCK_ASSIGNMENT"
                                    ownerId={truck.id}
                                    documentTypes={[...OPERATIONAL_DOC_TYPES]}
                                    title={`Upload BOL/POD — ${truck.displayId}`}
                                    defaultDocumentType="POD"
                                  />
                                </Can>
                              </div>
                              {truck.documents.length === 0 ? (
                                <EmptyState message="No BOL/POD/photos for this truck yet." />
                              ) : (
                                <DataTable headers={["Type", "File", "Ref", "Uploaded", ""]}>
                                  {truck.documents.map((doc) => (
                                    <tr key={doc.id}>
                                      <td className="px-3 py-2 font-medium">{doc.documentType}</td>
                                      <td className="px-3 py-2">
                                        <Link
                                          href={getSecureDocumentUrl({
                                            ownerType: "TRUCK_ASSIGNMENT",
                                            documentId: doc.id,
                                          })}
                                          className="text-sky-700 hover:underline"
                                          target="_blank"
                                        >
                                          {doc.fileName}
                                        </Link>
                                      </td>
                                      <td className="px-3 py-2">{doc.referenceNumber ?? "—"}</td>
                                      <td className="px-3 py-2">
                                        {doc.uploadedAt.toISOString().slice(0, 10)}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <Can permission="documents:write">
                                          {doc.isCurrent ? (
                                            <ArchiveButton
                                              label="Archive"
                                              action={async () => {
                                                "use server";
                                                await archiveDocument("TRUCK_ASSIGNMENT", doc.id);
                                              }}
                                            />
                                          ) : null}
                                        </Can>
                                      </td>
                                    </tr>
                                  ))}
                                </DataTable>
                              )}
                            </div>

                            <div>
                              <div className="mb-2 flex items-center justify-between">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Cargo (truck-specific)
                                </h3>
                                <Can permission="jobs:write">
                                  <DedicatedEntityForm
                                    title={`Cargo for ${truck.displayId}`}
                                    submitLabel="Add Cargo"
                                    collapsible
                                    fields={[
                                      {
                                        name: "materialCategory",
                                        label: "Category",
                                        section: "Material",
                                        options: [
                                          { value: "CASING", label: "Casing" },
                                          { value: "TUBING", label: "Tubing" },
                                          { value: "DRILL_PIPE", label: "Drill Pipe" },
                                          { value: "PRODUCTION_EQUIPMENT", label: "Production Equipment" },
                                          { value: "RIG_EQUIPMENT", label: "Rig Equipment" },
                                          { value: "FLATBED_FREIGHT", label: "Flatbed Freight" },
                                          { value: "MISCELLANEOUS", label: "Miscellaneous" },
                                          { value: "CUSTOM", label: "Custom" },
                                        ],
                                      },
                                      {
                                        name: "materialDescription",
                                        label: "Description",
                                        required: true,
                                        section: "Material",
                                        fullWidth: true,
                                      },
                                      { name: "pipeGrade", label: "Pipe Grade", section: "Pipe" },
                                      {
                                        name: "pipeOutsideDiameterIn",
                                        label: "OD (in)",
                                        type: "number",
                                        section: "Pipe",
                                      },
                                      {
                                        name: "jointLengthFt",
                                        label: "Joint Length (ft)",
                                        type: "number",
                                        section: "Pipe",
                                      },
                                      {
                                        name: "numberOfJoints",
                                        label: "Number of Joints",
                                        type: "number",
                                        section: "Pipe",
                                      },
                                      {
                                        name: "totalFootage",
                                        label: "Total Footage (ft)",
                                        type: "number",
                                        section: "Weight",
                                      },
                                      {
                                        name: "weightPerFoot",
                                        label: "Weight Per Foot (lb/ft)",
                                        type: "number",
                                        section: "Weight",
                                      },
                                      {
                                        name: "manualWeightOverrideLbs",
                                        label: "Weight Override (lb)",
                                        type: "number",
                                        section: "Weight",
                                      },
                                      { name: "heatNumber", label: "Heat Number", section: "Refs" },
                                      { name: "quantity", label: "Quantity", type: "number", section: "Refs" },
                                      { name: "unit", label: "Unit", section: "Refs" },
                                      {
                                        name: "customerMaterialRef",
                                        label: "Customer Material Ref",
                                        section: "Refs",
                                      },
                                      { name: "notes", label: "Notes", section: "Notes", fullWidth: true },
                                    ]}
                                    onSubmit={async (data) => {
                                      "use server";
                                      await addCargoItem(truck.id, data);
                                    }}
                                  />
                                </Can>
                              </div>
                              {truck.cargoItems.length === 0 ? (
                                <EmptyState message="No cargo on this truck yet. Each truck can carry different material." />
                              ) : (
                                <DataTable
                                  headers={["Material", "Footage", "lb/ft", "Weight", "Heat #", ""]}
                                >
                                  {truck.cargoItems.map((item) => (
                                    <tr key={item.id}>
                                      <td className="px-3 py-2">
                                        <div className="font-medium">{item.materialDescription}</div>
                                        <div className="text-[11px] text-slate-400">
                                          {item.materialCategory.replaceAll("_", " ")}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {item.totalFootage
                                          ? formatFootage(item.totalFootage.toString())
                                          : "—"}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {item.weightPerFoot?.toString() ?? "—"}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {formatWeight(
                                          (
                                            item.manualWeightOverrideLbs ??
                                            item.calculatedWeightLbs ??
                                            0
                                          ).toString()
                                        )}
                                      </td>
                                      <td className="px-3 py-2">{item.heatNumber ?? "—"}</td>
                                      <td className="px-3 py-2 text-right">
                                        <Can permission="jobs:write">
                                          <form
                                            action={async () => {
                                              "use server";
                                              await removeCargoItem(item.id);
                                            }}
                                          >
                                            <button
                                              type="submit"
                                              className="text-xs text-red-600 hover:underline"
                                            >
                                              Remove
                                            </button>
                                          </form>
                                        </Can>
                                      </td>
                                    </tr>
                                  ))}
                                </DataTable>
                              )}
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
