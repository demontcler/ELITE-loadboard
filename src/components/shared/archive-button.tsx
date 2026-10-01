"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function ArchiveButton({
  label,
  action,
}: {
  label: string;
  action: () => Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="h-8 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      onClick={() => {
        if (!confirm(`Confirm: ${label}?`)) return;
        startTransition(async () => {
          await action();
          router.refresh();
        });
      }}
    >
      {pending ? "…" : label}
    </button>
  );
}
