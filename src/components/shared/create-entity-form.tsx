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

export function CreateEntityForm({
  title,
  fields,
  onSubmit,
  submitLabel = "Create",
  defaultValues,
}: {
  title: string;
  fields: Field[];
  onSubmit: (data: Record<string, string>) => Promise<unknown>;
  submitLabel?: string;
  defaultValues?: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(defaultValues ?? {});

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
          payload[field.name] = values[field.name] ?? defaultValues?.[field.name] ?? "";
        }
        await onSubmit(payload);
        setOpen(false);
        setValues(defaultValues ?? {});
        router.refresh();
      } catch (err) {
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
