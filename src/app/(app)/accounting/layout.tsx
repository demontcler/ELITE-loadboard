import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-chrome";
import { AccountingNav } from "@/components/accounting/accounting-nav";

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounting"
        description="AR · AP · Settlements · Profitability — paperwork-gated readiness"
      />
      <Suspense fallback={null}>
        <AccountingNav />
      </Suspense>
      {children}
    </div>
  );
}
