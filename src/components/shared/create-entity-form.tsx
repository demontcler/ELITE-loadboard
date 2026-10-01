"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

function buildInitialValues(
  fields: Field[],
  defaultValues?: Record<string, string>
): Record<string, string> {
  const initial: Record<string, string> = { ...(defaultValues ?? {}) };
  for (const field of fields) {
    if (initial[field.name] !== undefined) continue;
    if (field.options?.length) {
      initial[field.name] = field.options[0]!.value;
    }
  }
  return initial;
}

export function CreateEntityForm({
  title,
  fields,
  onSubmit,
  submitLabel = "Create",
  defaultValues,
  defaultOpen = false,
  redirectBasePath,
}: {
  title: string;
  fields: Field[];
  onSubmit: (data: Record<string, string>) => Promise<unknown>;
  submitLabel?: string;
  defaultValues?: Record<string, string>;
  defaultOpen?: boolean;
  /** If onSubmit returns `{ id }`, navigate to `${redirectBasePath}/${id}` */
  redirectBasePath?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(fields, defaultValues)
  );

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const payload: Record<string, string> = {};
        for (const field of fields) {
          payload[field.name] =
            values[field.name] ??
            defaultValues?.[field.name] ??
            field.options?.[0]?.value ??
            "";
        }
        const result = (await onSubmit(payload)) as
          | { id?: string; redirectTo?: string }
          | void
          | null;

        if (result && typeof result === "object") {
          if (result.redirectTo) {
            router.push(result.redirectTo);
            router.refresh();
            return;
          }
          if (result.id && redirectBasePath) {
            router.push(`${redirectBasePath}/${result.id}`);
            router.refresh();
            return;
          }
        }

        setOpen(false);
        setValues(buildInitialValues(fields, defaultValues));
        router.refresh();
      } catch (err) {
        // Next.js redirect() throws; let the framework handle it
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        {submitLabel}
      </Button>
    );
  }

  return (
    <Card className="mb-4 border-slate-300">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <div key={field.name} className="space-y-1">
              <Label htmlFor={field.name}>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              {field.options ? (
                <select
                  id={field.name}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={values[field.name] ?? defaultValues?.[field.name] ?? field.options[0]?.value ?? ""}
                  onChange={(e) => setField(field.name, e.target.value)}
                  required={field.required}
                >
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={field.name}
                  type={field.type ?? "text"}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ""}
                  onChange={(e) => setField(field.name, e.target.value)}
                />
              )}
            </div>
          ))}
          {error ? (
            <p className="sm:col-span-2 lg:col-span-3 text-sm text-red-600">{error}</p>
          ) : null}
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
