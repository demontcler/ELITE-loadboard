"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { globalSearch, type SearchResult } from "@/server/search";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      startTransition(async () => {
        const rows = await globalSearch(q);
        setResults(rows);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div ref={wrapRef} className="relative max-w-md flex-1">
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm">
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search jobs, PO, carriers, drivers, rigs…"
          className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
          aria-label="Global search"
        />
        {pending ? <span className="text-[10px] text-slate-400">…</span> : null}
      </div>
      {open && results.length > 0 ? (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {results.map((r) => (
            <Link
              key={`${r.type}-${r.id}`}
              href={r.href}
              onClick={() => {
                setOpen(false);
                setQ("");
              }}
              className="block border-b border-slate-100 px-3 py-2 hover:bg-slate-50"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {r.type}
              </div>
              <div className="text-sm font-medium text-slate-900">{r.title}</div>
              {r.subtitle ? <div className="text-xs text-slate-500">{r.subtitle}</div> : null}
            </Link>
          ))}
        </div>
      ) : null}
      {open && q.trim().length >= 2 && !pending && results.length === 0 ? (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500 shadow-lg">
          No matches for “{q}”
        </div>
      ) : null}
    </div>
  );
}
