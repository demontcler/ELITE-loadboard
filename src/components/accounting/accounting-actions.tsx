"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ActionButton({
  label,
  action,
  variant = "default",
  confirm,
}: {
  label: string;
  action: () => Promise<unknown>;
  variant?: "default" | "primary" | "danger";
  confirm?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const className =
    variant === "primary"
      ? "h-8 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      : variant === "danger"
        ? "h-8 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        : "h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          startTransition(async () => {
            try {
              await action();
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Action failed");
            }
          });
        }}
      >
        {pending ? "…" : label}
      </button>
      {error ? <span className="text-[10px] text-red-600">{error}</span> : null}
    </span>
  );
}

export function PaymentForm({
  invoiceId,
  remainingBalance,
  action,
}: {
  invoiceId: string;
  remainingBalance: string;
  action: (raw: unknown) => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="h-8 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
        onClick={() => setOpen(true)}
      >
        Record Payment
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            await action({
              invoiceId,
              amount: fd.get("amount"),
              paymentDate: fd.get("paymentDate"),
              paymentMethod: fd.get("paymentMethod"),
              referenceNumber: fd.get("referenceNumber"),
              notes: fd.get("notes"),
            });
            setOpen(false);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment failed");
          }
        });
      }}
    >
      <label className="text-[11px] text-slate-500">
        Amount (bal {remainingBalance})
        <input
          name="amount"
          required
          type="number"
          step="0.01"
          min="0.01"
          className="mt-0.5 block h-8 w-28 rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="text-[11px] text-slate-500">
        Date
        <input
          name="paymentDate"
          type="date"
          className="mt-0.5 block h-8 rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="text-[11px] text-slate-500">
        Method
        <input
          name="paymentMethod"
          placeholder="ACH / Check"
          className="mt-0.5 block h-8 w-28 rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="text-[11px] text-slate-500">
        Ref #
        <input
          name="referenceNumber"
          className="mt-0.5 block h-8 w-28 rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-md bg-emerald-700 px-3 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
      <button
        type="button"
        className="h-8 rounded-md px-2 text-xs text-slate-500"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
      {error ? <span className="w-full text-[10px] text-red-600">{error}</span> : null}
    </form>
  );
}

export function AccessorialForm({
  truckOptions,
  action,
}: {
  truckOptions: Array<{ value: string; label: string }>;
  action: (raw: unknown) => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            await action({
              truckAssignmentId: fd.get("truckAssignmentId"),
              type: fd.get("type"),
              description: fd.get("description"),
              amount: fd.get("amount"),
              customerAmount: fd.get("customerAmount") || fd.get("amount"),
              carrierAmount: fd.get("carrierAmount") || null,
              billToCustomer: fd.get("billToCustomer") === "on",
              payToCarrier: fd.get("payToCarrier") === "on",
              notes: fd.get("notes"),
            });
            e.currentTarget.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
      <label className="text-[11px] text-slate-500 md:col-span-2">
        Truck Assignment
        <select
          name="truckAssignmentId"
          required
          className="mt-0.5 block h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm"
        >
          <option value="">— Select —</option>
          {truckOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] text-slate-500">
        Type
        <select
          name="type"
          required
          className="mt-0.5 block h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm"
        >
          {[
            "DETENTION",
            "LAYOVER",
            "TONU",
            "FUEL_SURCHARGE",
            "EXTRA_STOP",
            "DRIVER_ASSIST",
            "TARP",
            "OVER_DIMENSIONAL",
            "PERMIT",
            "ADDITIONAL_LABOR",
            "OTHER",
          ].map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] text-slate-500">
        Amount
        <input
          name="amount"
          required
          type="number"
          step="0.01"
          className="mt-0.5 block h-9 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="text-[11px] text-slate-500 md:col-span-2">
        Description
        <input
          name="description"
          className="mt-0.5 block h-9 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="text-[11px] text-slate-500">
        Customer Amt
        <input
          name="customerAmount"
          type="number"
          step="0.01"
          className="mt-0.5 block h-9 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="text-[11px] text-slate-500">
        Carrier Amt
        <input
          name="carrierAmount"
          type="number"
          step="0.01"
          className="mt-0.5 block h-9 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input name="billToCustomer" type="checkbox" defaultChecked /> Bill customer
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input name="payToCarrier" type="checkbox" /> Pay carrier
      </label>
      <div className="md:col-span-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-md bg-slate-900 px-3 text-xs text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add Accessorial"}
        </button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    </form>
  );
}

export function SettlementForm({
  payables,
  action,
}: {
  payables: Array<{ id: string; label: string }>;
  action: (ids: string[]) => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">Create Settlement</div>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {payables.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={(e) => {
                setSelected((prev) =>
                  e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                );
              }}
            />
            {p.label}
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={pending || selected.length === 0}
        className="h-8 rounded-md bg-slate-900 px-3 text-xs text-white disabled:opacity-50"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await action(selected);
              setSelected([]);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        {pending ? "…" : `Settle ${selected.length} payable(s)`}
      </button>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}
