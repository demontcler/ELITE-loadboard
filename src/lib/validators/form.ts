import { ZodError, type ZodType } from "zod";

export type FieldErrors = Record<string, string>;

const FRIENDLY: Record<string, string> = {
  invalid_type: "This field is required or has an invalid value.",
  too_small: "This value is too short or too small.",
  too_big: "This value is too long or too large.",
  invalid_string: "Enter a valid value.",
  invalid_enum_value: "Select a valid option.",
};

export function formatZodError(error: ZodError): { message: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    if (fieldErrors[key]) continue;
    if (issue.message && !issue.message.startsWith("Invalid") && issue.message.length < 120) {
      fieldErrors[key] = issue.message;
    } else {
      fieldErrors[key] = FRIENDLY[issue.code] ?? "Invalid value.";
    }
  }
  const first = Object.values(fieldErrors)[0] ?? "Please correct the highlighted fields.";
  return { message: first, fieldErrors };
}

export function parseWithFieldErrors<T>(schema: ZodType<T>, raw: unknown):
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors: FieldErrors } {
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const formatted = formatZodError(result.error);
  return { ok: false, ...formatted };
}

export class ActionError extends Error {
  fieldErrors?: FieldErrors;
  constructor(message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = "ActionError";
    this.fieldErrors = fieldErrors;
  }
}

export function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] === "") (out as Record<string, unknown>)[key] = null;
  }
  return out;
}
