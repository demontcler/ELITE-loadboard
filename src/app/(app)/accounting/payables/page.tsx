import Link from "next/link";
import {
  listPayables,
  approvePayable,
  markPayablePaid,
  syncCarrierPayable,
  createSettlementFromPayables,
} from "@/server/accounting";
import { DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { ActionButton, SettlementForm } from "@/components/accounting/accounting-actions";
import { Can } from "@/components/auth/can";
import { formatCurrencyPrecise } from "@/lib/utils";

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const payables = await listPayables({ status: params.status || undefined });
  const settleable = payables.filter((p) =>
    ["READY_FOR_APPROVAL", "APPROVED"].includes(p.status)
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Carrier Payables / AP</h2>
        <form className="flex gap-2">
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
          >
            <option value="">All statuses</option>
            {[
              "NOT_READY",
              "PAPERWORK_HOLD",
              "READY_FOR_APPROVAL",
              "APPROVED",
              "SCHEDULED",
              "PAID",
              "DISPUTED",
              "VOID",
            ].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <button type="submit" className="h-8 rounded-md bg-slate-900 px-3 text-xs text-white">
            Filter
          </button>
        </form>
      </div>

      {payables.length === 0 ? (
        <EmptyState message="No carrier payables. Sync from a truck assignment with a carrier rate." />
      ) : (
        <DataTable
          headers={[
            "Payable",
            "Carrier",
            "Job / Truck",
            "Base",
            "Accessorial",
            "Total",
            "Paperwork",
            "Status",
            "Actions",
          ]}
        >
          {payables.map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">{p.payableNumber}</td>
              <td className="px-3 py-2">{p.carrier.legalName}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/jobs/${p.truckAssignment.job.id}`}
                  className="text-blue-700 hover:underline"
                >
                  {p.truckAssignment.job.jobNumber}
                </Link>{" "}
                / {p.truckAssignment.displayId}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(p.baseRate.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(p.accessorialPay.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums font-medium">
                {formatCurrencyPrecise(p.totalPayable.toString())}
              </td>
              <td className="px-3 py-2 text-xs">
                {p.paperworkComplete ? (
                  <span className="text-emerald-700">Complete</span>
                ) : (
                  <span className="text-red-700">{p.paperworkHoldReason || "Hold"}</span>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  <Can permission="accounting:write">
                    <ActionButton
                      label="Sync"
                      action={async () => {
                        "use server";
                        await syncCarrierPayable(p.truckAssignmentId);
                      }}
                    />
                  </Can>
                  <Can permission="accounting:approve_payment">
                    {p.status === "READY_FOR_APPROVAL" ? (
                      <ActionButton
                        label="Approve"
                        variant="primary"
                        action={async () => {
                          "use server";
                          await approvePayable(p.id);
                        }}
                      />
                    ) : null}
                    {["APPROVED", "SCHEDULED", "READY_FOR_APPROVAL"].includes(p.status) &&
                    p.paperworkComplete ? (
                      <ActionButton
                        label="Mark Paid"
                        variant="primary"
                        confirm="Mark this payable as paid?"
                        action={async () => {
                          "use server";
                          await markPayablePaid(p.id);
                        }}
                      />
                    ) : null}
                  </Can>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Can permission="accounting:write">
        <SettlementForm
          payables={settleable.map((p) => ({
            id: p.id,
            label: `${p.payableNumber} — ${p.carrier.legalName} — ${formatCurrencyPrecise(p.totalPayable.toString())}`,
          }))}
          action={async (ids) => {
            "use server";
            await createSettlementFromPayables(ids);
          }}
        />
      </Can>
    </div>
  );
}
