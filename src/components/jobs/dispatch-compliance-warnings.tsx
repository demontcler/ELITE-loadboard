"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getDispatchComplianceWarnings } from "@/server/compliance";
import type { ComplianceAlert } from "@/lib/calculations/paperwork";

export function DispatchComplianceWarnings({
  carrierId,
  driverId,
  tractorId,
  trailerId,
}: {
  carrierId?: string | null;
  driverId?: string | null;
  tractorId?: string | null;
  trailerId?: string | null;
}) {
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!carrierId && !driverId && !tractorId && !trailerId) {
        setAlerts([]);
        return;
      }
      try {
        const rows = await getDispatchComplianceWarnings({
          carrierId,
          driverId,
          tractorId,
          trailerId,
        });
        if (!cancelled) setAlerts(rows);
      } catch {
        if (!cancelled) setAlerts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [carrierId, driverId, tractorId, trailerId]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
        Compliance warnings (WARNING_ONLY)
      </div>
      <div className="flex flex-wrap gap-1">
        {alerts.map((a, i) => (
          <Badge key={`${a.entityId}-${a.documentType}-${i}`} variant="warning">
            {a.message}
          </Badge>
        ))}
      </div>
    </div>
  );
}
