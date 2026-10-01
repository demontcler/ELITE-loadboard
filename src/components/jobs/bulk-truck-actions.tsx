"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BulkTruckActions({
  trucks,
  carriers,
  onBulk,
}: {
  trucks: { id: string; displayId: string }[];
  carriers: { id: string; legalName: string }[];
  onBulk: (payload: {
    truckAssignmentIds: string[];
    carrierId?: string;
    pickupDate?: string;
    pickupTime?: string;
    equipmentType?: string;
    trailerType?: string;
  }) => Promise<void>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [carrierId, setCarrierId] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [trailerType, setTrailerType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = selected.size > 0 && selected.size === trucks.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(trucks.map((t) => t.id)));
  }

  function runBulk() {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setError("Select at least one truck.");
      return;
    }
    if (!carrierId && !pickupDate && !pickupTime && !equipmentType && !trailerType) {
      setError("Choose at least one bulk field to apply.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await onBulk({
          truckAssignmentIds: ids,
          carrierId: carrierId || undefined,
          pickupDate: pickupDate || undefined,
          pickupTime: pickupTime || undefined,
          equipmentType: equipmentType || undefined,
          trailerType: trailerType || undefined,
        });
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bulk update failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Bulk actions ({selected.size} selected)
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Select all trucks
          </label>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {trucks.map((t) => (
            <label
              key={t.id}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
            >
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => toggle(t.id)}
              />
              {t.displayId}
            </label>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label>Assign Carrier</Label>
            <select
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={carrierId}
              onChange={(e) => setCarrierId(e.target.value)}
            >
              <option value="">— No change —</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legalName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Pickup Date</Label>
            <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Pickup Time</Label>
            <Input
              placeholder="07:00"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Equipment Type</Label>
            <Input
              placeholder="e.g. Pipe Trailer"
              value={equipmentType}
              onChange={(e) => setEquipmentType(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Trailer Type</Label>
            <select
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={trailerType}
              onChange={(e) => setTrailerType(e.target.value)}
            >
              <option value="">— No change —</option>
              <option value="FLATBED">Flatbed</option>
              <option value="STEP_DECK">Step Deck</option>
              <option value="PIPE_TRAILER">Pipe Trailer</option>
              <option value="RGN">RGN</option>
              <option value="HOTSHOT">Hotshot</option>
              <option value="DOUBLE_DROP">Double Drop</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Bulk actions never overwrite truck-specific cargo.
        </p>
        {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
        <div className="mt-2">
          <Button type="button" size="sm" disabled={pending} onClick={runBulk}>
            {pending ? "Applying…" : "Apply to Selected"}
          </Button>
        </div>
      </div>
    </div>
  );
}
