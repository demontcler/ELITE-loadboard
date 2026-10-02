/**
 * Structured server logging — never log secrets or document contents.
 */

type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, string | number | boolean | null | undefined>;

const SENSITIVE_KEYS = /password|secret|token|authorization|cookie|credential|storage_key|private.?key|w-?9|cdl/i;

function sanitize(fields?: LogFields): LogFields | undefined {
  if (!fields) return undefined;
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SENSITIVE_KEYS.test(k)) {
      out[k] = "[redacted]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: LogLevel, event: string, fields?: LogFields) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    env: process.env.APP_ENV || process.env.NODE_ENV || "development",
    ...sanitize(fields),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Optional error monitoring hook (no provider required)
  if (level === "error" && typeof globalThis !== "undefined") {
    const hook = (globalThis as { __ELITE_ERROR_HOOK__?: (p: unknown) => void }).__ELITE_ERROR_HOOK__;
    try {
      hook?.(payload);
    } catch {
      // never throw from logging
    }
  }
}

export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/** Register a production error-monitoring callback without coupling to a vendor. */
export function registerErrorHook(fn: (payload: unknown) => void) {
  (globalThis as { __ELITE_ERROR_HOOK__?: (p: unknown) => void }).__ELITE_ERROR_HOOK__ = fn;
}
