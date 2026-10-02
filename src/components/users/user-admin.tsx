"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, setUserActive, updateUserRole } from "@/server/users";

export function CreateUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <form
      className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        setError(null);
        setOk(null);
        startTransition(async () => {
          try {
            const user = await createUser({
              email: fd.get("email"),
              firstName: fd.get("firstName"),
              lastName: fd.get("lastName"),
              role: fd.get("role"),
              temporaryPassword: fd.get("temporaryPassword"),
            });
            setOk(`Created ${user.email}`);
            e.currentTarget.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create user");
          }
        });
      }}
    >
      <label className="text-[11px] text-slate-500">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-0.5 block h-9 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="text-[11px] text-slate-500">
        First name
        <input
          name="firstName"
          required
          className="mt-0.5 block h-9 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="text-[11px] text-slate-500">
        Last name
        <input
          name="lastName"
          required
          className="mt-0.5 block h-9 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="text-[11px] text-slate-500">
        Role
        <select
          name="role"
          className="mt-0.5 block h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm"
          defaultValue="DISPATCHER"
        >
          <option value="ADMIN">ADMIN</option>
          <option value="DISPATCHER">DISPATCHER</option>
          <option value="ACCOUNTING">ACCOUNTING</option>
          <option value="OPERATIONS_MANAGER">OPERATIONS_MANAGER</option>
          <option value="VIEW_ONLY">VIEW_ONLY</option>
        </select>
      </label>
      <label className="text-[11px] text-slate-500 md:col-span-2">
        Temporary password (min 12)
        <input
          name="temporaryPassword"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          className="mt-0.5 block h-9 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <div className="md:col-span-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-md bg-slate-900 px-3 text-xs text-white disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create user"}
        </button>
        {error ? (
          <span className="text-xs text-red-600" role="alert">
            {error}
          </span>
        ) : null}
        {ok ? <span className="text-xs text-emerald-700">{ok}</span> : null}
      </div>
    </form>
  );
}

export function UserRowActions({
  userId,
  role,
  isActive,
}: {
  userId: string;
  role: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <select
        defaultValue={role}
        disabled={pending}
        className="h-8 rounded border border-slate-300 bg-white px-1 text-xs"
        aria-label="Change role"
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            try {
              await updateUserRole({ userId, role: next });
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        {["ADMIN", "DISPATCHER", "ACCOUNTING", "OPERATIONS_MANAGER", "VIEW_ONLY"].map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        className="h-8 rounded-md border border-slate-200 px-2 text-xs"
        onClick={() => {
          startTransition(async () => {
            try {
              await setUserActive(userId, !isActive);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </button>
      {error ? (
        <span className="text-[10px] text-red-600" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
