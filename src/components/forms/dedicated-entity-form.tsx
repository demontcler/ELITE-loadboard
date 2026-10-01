"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type FormField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  section?: string;
  fullWidth?: boolean;
};

export function DedicatedEntityForm({
  title,
  description,
  fields,
  defaultValues,
  submitLabel = "Save",
  onSubmit,
  onCancel,
  redirectTo,
  redirectBasePath,
  collapsible = false,
}: {
  title: string;
  description?: string;
  fields: FormField[];
  defaultValues?: Record<string, string>;
  submitLabel?: string;
  onSubmit: (data: Record<string, string>) => Promise<unknown>;
  onCancel?: () => void;
  redirectTo?: string;
  /** If onSubmit returns `{ id }`, navigate to `${redirectBasePath}/${id}` */
  redirectBasePath?: string;
  collapsible?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!collapsible);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = { ...(defaultValues ?? {}) };
    for (const field of fields) {
      if (initial[field.name] !== undefined) continue;
      if (field.options?.length) initial[field.name] = field.options[0]!.value;
    }
    return initial;
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sections = Array.from(
    new Set(fields.map((f) => f.section ?? "Details"))
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    startTransition(async () => {
      try {
        const payload: Record<string, string> = {};
        for (const field of fields) {
          payload[field.name] =
            values[field.name] ?? defaultValues?.[field.name] ?? field.options?.[0]?.value ?? "";
        }
        const result = await onSubmit(payload) as
          | { ok?: boolean; message?: string; fieldErrors?: Record<string, string>; id?: string }
          | { id?: string }
          | void
          | null;

        if (result && typeof result === "object" && "ok" in result && result.ok === false) {
          setFormError(result.message ?? "Please correct the highlighted fields.");
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          return;
        }

        if (redirectBasePath && result && typeof result === "object" && "id" in result && result.id) {
          router.push(`${redirectBasePath}/${result.id}`);
          router.refresh();
          return;
        }
        if (redirectTo) {
          router.push(redirectTo);
          router.refresh();
          return;
        }
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save";
        if (message.includes("Forbidden") || message.includes("Unauthorized")) {
          setFormError("You do not have permission to perform this action.");
        } else {
          setFormError(message);
        }
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        {title}
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
        {collapsible ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {sections.map((section) => (
            <div key={section} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {section}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fields
                  .filter((f) => (f.section ?? "Details") === section)
                  .map((field) => (
                    <div
                      key={field.name}
                      className={field.fullWidth ? "sm:col-span-2 lg:col-span-3 space-y-1" : "space-y-1"}
                    >
                      <Label htmlFor={field.name}>
                        {field.label}
                        {field.required ? " *" : ""}
                      </Label>
                      {field.options ? (
                        <select
                          id={field.name}
                          className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                          value={values[field.name] ?? ""}
                          onChange={(e) =>
                            setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                          }
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
                          onChange={(e) =>
                            setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                          }
                        />
                      )}
                      {fieldErrors[field.name] ? (
                        <p className="text-xs text-red-600">{fieldErrors[field.name]}</p>
                      ) : null}
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
