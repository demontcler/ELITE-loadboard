"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/accounting", label: "Overview", exact: true },
  { href: "/accounting/invoices", label: "AR / Invoices" },
  { href: "/accounting/payables", label: "AP / Payables" },
  { href: "/accounting/settlements", label: "Settlements" },
  { href: "/accounting/ready", label: "Ready to Invoice" },
  { href: "/accounting/holds", label: "On Hold" },
  { href: "/accounting/accessorials", label: "Accessorials" },
  { href: "/accounting/aging", label: "AR Aging" },
  { href: "/accounting/reports", label: "Profitability" },
];

export function AccountingNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams.get("section");

  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
      {SECTIONS.map((s) => {
        const active = s.exact
          ? pathname === "/accounting" && !section
          : pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
