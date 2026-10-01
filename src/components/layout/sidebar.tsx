"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  Truck,
  Users,
  Wrench,
  Calculator,
  FileText,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/layout/global-search";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/load-board", label: "Load Board", icon: ClipboardList },
  { href: "/customers", label: "Customers", icon: Building2 },
  { href: "/carriers", label: "Carriers", icon: Truck },
  { href: "/drivers", label: "Drivers", icon: Users },
  { href: "/equipment", label: "Equipment", icon: Wrench },
  { href: "/accounting", label: "Accounting", icon: Calculator },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-500">
          ELITE
        </div>
        <div className="text-sm font-semibold leading-tight">Loadboard TMS</div>
        <div className="mt-0.5 text-[11px] text-slate-400">Oilfield · Pipe · Flatbed</div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AppHeader({
  userName,
  role,
}: {
  userName: string;
  role: string;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
      <GlobalSearch />
      <div className="flex items-center gap-3 text-sm">
        <div className="text-right">
          <div className="font-medium text-slate-900">{userName}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {role.replaceAll("_", " ")}
          </div>
        </div>
        <form action="/api/auth/signout" method="POST" className="shrink-0">
          <button
            type="submit"
            name="signout"
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
