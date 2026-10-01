"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Option = { value: string; label: string; carrierId?: string | null };

export function AssignTruckForm({
  title,
  submitLabel = "Save Assignment",
  defaultValues,
  carriers,
  drivers,
  tractors,
  trailers,
  onSubmit,
}: {
  title: string;
  submitLabel?: string;
  defaultValues: Record<string, string>;
  carriers: Option[];
  drivers: Option[];
  tractors: Option[];
  trailers: Option[];
  onSubmit: (data: Record<string, string>) => Promise<unknown>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(defaultValues);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const carrierId = values.carrierId || "";

  const filteredDrivers = useMemo(
    () =>
      drivers.filter(
        (d) => !carrierId || !d.carrierId || d.carrierId === carrierId || d.value === ""
      ),
    [drivers, carrierId]
  );
  const filteredTractors = useMemo(
    () =>
      tractors.filter(
        (t) => !carrierId || !t.carrierId || t.carrierId === carrierId || t.value === ""
      ),
    [tractors, carrierId]
  );
  const filteredTrailers = useMemo(
    () =>
      trailers.filter(
        (t) => !carrierId || !t.carrierId || t.carrierId === carrierId || t.value === ""
      ),
    [trailers, carrierId]
  );

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        {title}
      </Button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await onSubmit(values);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save assignment");
      }
    });
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="carrierId">Carrier</Label>
            <select
              id="carrierId"
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={values.carrierId ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, carrierId: e.target.value }))}
            >
              {carriers.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="driverId">Driver</Label>
            <select
              id="driverId"
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={values.driverId ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, driverId: e.target.value }))}
            >
              {filteredDrivers.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="driverPhone">Driver Phone</Label>
            <Input
              id="driverPhone"
              value={values.driverPhone ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, driverPhone: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tractorId">Tractor</Label>
            <select
              id="tractorId"
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={values.tractorId ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, tractorId: e.target.value }))}
            >
              {filteredTractors.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="trailerId">Trailer</Label>
            <select
              id="trailerId"
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={values.trailerId ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, trailerId: e.target.value }))}
            >
              {filteredTrailers.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="trailerType">Equipment Type</Label>
            <select
              id="trailerType"
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={values.trailerType ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, trailerType: e.target.value }))}
            >
              <option value="">—</option>
              <option value="FLATBED">Flatbed</option>
              <option value="STEP_DECK">Step Deck</option>
              <option value="PIPE_TRAILER">Pipe Trailer</option>
              <option value="RGN">RGN</option>
              <option value="HOTSHOT">Hotshot</option>
              <option value="DOUBLE_DROP">Double Drop</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pickupDate">Pickup Date</Label>
            <Input
              id="pickupDate"
              type="date"
              value={values.pickupDate ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, pickupDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pickupTime">Pickup Time</Label>
            <Input
              id="pickupTime"
              placeholder="07:00"
              value={values.pickupTime ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, pickupTime: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="carrierRate">Carrier Rate ($)</Label>
            <Input
              id="carrierRate"
              type="number"
              value={values.carrierRate ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, carrierRate: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="revenueAllocation">Revenue Allocation ($)</Label>
            <Input
              id="revenueAllocation"
              type="number"
              value={values.revenueAllocation ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, revenueAllocation: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={values.status ?? "UNASSIGNED"}
              onChange={(e) => setValues((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="UNASSIGNED">Unassigned</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="POD_RECEIVED">POD Received</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={values.notes ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          {error ? <p className="sm:col-span-2 lg:col-span-3 text-sm text-red-600">{error}</p> : null}
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
