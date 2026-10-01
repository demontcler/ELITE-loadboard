import { listSettlements } from "@/server/accounting";
import { DataTable, EmptyState, StatusBadge } from "@/components/shared/page-chrome";
import { formatCurrencyPrecise } from "@/lib/utils";

export default async function SettlementsPage() {
  const settlements = await listSettlements();

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">Carrier / Driver Settlements</h2>
      {settlements.length === 0 ? (
        <EmptyState message="No settlements yet. Create from approved payables." />
      ) : (
        <DataTable
          headers={[
            "Settlement",
            "Carrier",
            "Base",
            "Accessorials",
            "Deductions",
            "Total",
            "Payables",
            "Docs",
            "Status",
          ]}
        >
          {settlements.map((s) => (
            <tr key={s.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">{s.settlementNumber}</td>
              <td className="px-3 py-2">{s.carrier.legalName}</td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(s.basePay.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(s.accessorialPay.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatCurrencyPrecise(s.deductions.toString())}
              </td>
              <td className="px-3 py-2 tabular-nums font-medium">
                {formatCurrencyPrecise(s.amount.toString())}
              </td>
              <td className="px-3 py-2 text-xs">
                {s.payables.map((p) => p.payableNumber).join(", ") || s._count.lineItems}
              </td>
              <td className="px-3 py-2">
                {s.documentsComplete ? (
                  <span className="text-emerald-700">Complete</span>
                ) : (
                  <span className="text-amber-700">Pending</span>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={s.status} />
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
