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
} from "@/server/jobs";
import { listCarriers } from "@/server/carriers";
import { listDrivers } from "@/server/drivers";
import { PageHeader, StatusBadge, EmptyState, DataTable } from "@/components/shared/page-chrome";
import { CreateEntityForm } from "@/components/shared/create-entity-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatWeight, formatFootage, formatPercent } from "@/lib/utils";
import { summarizeTruckProgress, type TruckStatusLike } from "@/lib/calculations/job-status";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [job, carriers, drivers] = await Promise.all([
    getJob(id),
    listCarriers(),
    listDrivers(),
  ]);
  if (!job) notFound();

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
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <div className="text-slate-500">Customer rate {formatCurrency(job.customerRate?.toString())}</div>
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
              {job.pickupGateInstructions ? (
                <div className="mt-1 text-xs">Gate: {job.pickupGateInstructions}</div>
              ) : null}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Delivery</div>
              <div className="whitespace-pre-wrap">{job.deliveryDirections || "—"}</div>
              {job.fieldContactName ? (
                <div className="mt-1 text-xs">
                  Field: {job.fieldContactName}
                  {job.fieldContactPhone ? ` · ${job.fieldContactPhone}` : ""}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Truck Assignments</h2>
          <div className="flex gap-2">
            <form
              action={async () => {
                "use server";
                await addTruckAssignments(job.id, 1);
              }}
            >
              <button className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium hover:bg-slate-50">
                Add Truck
              </button>
            </form>
          </div>
        </div>

        {job.trucks.length === 0 ? (
          <EmptyState message="No truck assignments." />
        ) : (
          <div className="space-y-3">
            {job.trucks.map((truck) => (
              <Card key={truck.id} className={truck.weightWarning ? "border-amber-400" : undefined}>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="text-base">
                      {truck.displayId}{" "}
                      <span className="text-slate-400">#{truck.assignmentNumber}</span>
                    </CardTitle>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <StatusBadge status={truck.status} />
                      {truck.weightWarning ? <Badge variant="warning">Overweight</Badge> : null}
                      {!truck.driverId ? <Badge variant="danger">Missing driver</Badge> : null}
                      {!truck.carrierId ? <Badge variant="warning">Missing carrier</Badge> : null}
                      {!truck.trailerId && !truck.trailerType ? (
                        <Badge variant="default">No trailer</Badge>
                      ) : null}
                      {!truck.documents.some((d) => d.documentType === "POD") ? (
                        <Badge variant="default">No POD</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <div>{formatFootage(truck.totalFootage.toString())}</div>
                    <div className="font-medium">{formatWeight(truck.totalWeightLbs.toString())}</div>
                    <div className="text-slate-500">
                      Cost {formatCurrency(truck.totalCost.toString())}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 text-sm md:grid-cols-4">
                    <div>
                      <div className="text-[11px] uppercase text-slate-400">Carrier</div>
                      <div>{truck.carrier?.legalName ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-slate-400">Driver</div>
                      <div>
                        {truck.driver
                          ? `${truck.driver.firstName} ${truck.driver.lastName}`
                          : "—"}
                        {truck.driverPhone || truck.driver?.phone
                          ? ` · ${truck.driverPhone || truck.driver?.phone}`
                          : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-slate-400">Equipment</div>
                      <div>
                        {[truck.tractor?.unitNumber, truck.trailer?.unitNumber || truck.trailerType]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-slate-400">Rate</div>
                      <div>{formatCurrency(truck.carrierRate?.toString())}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <CreateEntityForm
                      title={`Assign ${truck.displayId}`}
                      submitLabel="Assign"
                      fields={[
                        {
                          name: "carrierId",
                          label: "Carrier",
                          options: [
                            { value: "", label: "— Select —" },
                            ...carriers.map((c) => ({ value: c.id, label: c.legalName })),
                          ],
                        },
                        {
                          name: "driverId",
                          label: "Driver",
                          options: [
                            { value: "", label: "— Select —" },
                            ...drivers.map((d) => ({
                              value: d.id,
                              label: `${d.lastName}, ${d.firstName}${d.carrier ? ` (${d.carrier.legalName})` : ""}`,
                            })),
                          ],
                        },
                        { name: "driverPhone", label: "Driver Phone" },
                        {
                          name: "trailerType",
                          label: "Trailer Type",
                          options: [
                            { value: "FLATBED", label: "Flatbed" },
                            { value: "STEP_DECK", label: "Step Deck" },
                            { value: "PIPE_TRAILER", label: "Pipe Trailer" },
                            { value: "RGN", label: "RGN" },
                            { value: "HOTSHOT", label: "Hotshot" },
                            { value: "DOUBLE_DROP", label: "Double Drop" },
                            { value: "OTHER", label: "Other" },
                          ],
                        },
                        { name: "carrierRate", label: "Carrier Rate ($)", type: "number" },
                        { name: "revenueAllocation", label: "Revenue Allocation ($)", type: "number" },
                        {
                          name: "status",
                          label: "Status",
                          options: [
                            { value: "UNASSIGNED", label: "Unassigned" },
                            { value: "ASSIGNED", label: "Assigned" },
                            { value: "CONFIRMED", label: "Confirmed" },
                            { value: "DISPATCHED", label: "Dispatched" },
                            { value: "IN_TRANSIT", label: "In Transit" },
                            { value: "DELIVERED", label: "Delivered" },
                            { value: "POD_RECEIVED", label: "POD Received" },
                            { value: "COMPLETED", label: "Completed" },
                            { value: "CANCELLED", label: "Cancelled" },
                          ],
                        },
                        { name: "notes", label: "Notes" },
                      ]}
                      defaultValues={{
                        carrierId: truck.carrierId ?? "",
                        driverId: truck.driverId ?? "",
                        driverPhone: truck.driverPhone ?? "",
                        trailerType: truck.trailerType ?? "FLATBED",
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
                      <button className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium hover:bg-slate-50">
                        Duplicate
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await removeTruckAssignment(truck.id);
                      }}
                    >
                      <button className="h-8 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50">
                        Remove
                      </button>
                    </form>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Cargo (truck-specific)
                      </h3>
                      <CreateEntityForm
                        title={`Cargo for ${truck.displayId}`}
                        submitLabel="Add Cargo"
                        fields={[
                          {
                            name: "materialCategory",
                            label: "Category",
                            options: [
                              { value: "CASING", label: "Casing" },
                              { value: "TUBING", label: "Tubing" },
                              { value: "DRILL_PIPE", label: "Drill Pipe" },
                              { value: "PRODUCTION_EQUIPMENT", label: "Production Equipment" },
                              { value: "RIG_EQUIPMENT", label: "Rig Equipment" },
                              { value: "VALVES", label: "Valves" },
                              { value: "SPOOLS", label: "Spools" },
                              { value: "SKIDS", label: "Skids" },
                              { value: "TANKS", label: "Tanks" },
                              { value: "PUMPS", label: "Pumps" },
                              { value: "GENERATORS", label: "Generators" },
                              { value: "OILFIELD_TOOLS", label: "Oilfield Tools" },
                              { value: "FLATBED_FREIGHT", label: "Flatbed Freight" },
                              { value: "MISCELLANEOUS", label: "Miscellaneous" },
                              { value: "CUSTOM", label: "Custom" },
                            ],
                          },
                          { name: "materialDescription", label: "Description", required: true },
                          { name: "pipeGrade", label: "Pipe Grade" },
                          { name: "pipeOutsideDiameterIn", label: "OD (in)", type: "number" },
                          { name: "jointLengthFt", label: "Joint Length (ft)", type: "number" },
                          { name: "numberOfJoints", label: "Number of Joints", type: "number" },
                          { name: "totalFootage", label: "Total Footage (ft)", type: "number" },
                          { name: "weightPerFoot", label: "Weight Per Foot (lb/ft)", type: "number" },
                          { name: "manualWeightOverrideLbs", label: "Weight Override (lb)", type: "number" },
                          { name: "heatNumber", label: "Heat Number" },
                          { name: "quantity", label: "Quantity", type: "number" },
                          { name: "unit", label: "Unit" },
                          { name: "customerMaterialRef", label: "Customer Material Ref" },
                          { name: "notes", label: "Notes" },
                        ]}
                        onSubmit={async (data) => {
                          "use server";
                          await addCargoItem(truck.id, data);
                        }}
                      />
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
                                {item.pipeOutsideDiameterIn
                                  ? ` · ${item.pipeOutsideDiameterIn}"`
                                  : ""}
                                {item.pipeGrade ? ` · ${item.pipeGrade}` : ""}
                              </div>
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {item.totalFootage ? formatFootage(item.totalFootage.toString()) : "—"}
                              {item.numberOfJoints && item.jointLengthFt
                                ? ` (${item.numberOfJoints} × ${item.jointLengthFt})`
                                : ""}
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
                              {item.manualWeightOverrideLbs ? (
                                <span className="ml-1 text-[10px] text-slate-400">override</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">{item.heatNumber ?? "—"}</td>
                            <td className="px-3 py-2 text-right">
                              <form
                                action={async () => {
                                  "use server";
                                  await removeCargoItem(item.id);
                                }}
                              >
                                <button className="text-xs text-red-600 hover:underline">
                                  Remove
                                </button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </DataTable>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
