/**
 * Environment configuration and production fail-safes.
 * Never log secret values.
 */

export type AppEnv = "local" | "development" | "staging" | "production" | "test";

export function getAppEnv(): AppEnv {
  const raw = (process.env.APP_ENV || process.env.NODE_ENV || "development").toLowerCase();
  if (raw === "production") return "production";
  if (raw === "staging") return "staging";
  if (raw === "test") return "test";
  if (raw === "local") return "local";
  return "development";
}

export function isProductionLike(): boolean {
  const env = getAppEnv();
  return env === "production" || env === "staging";
}

export function isProduction(): boolean {
  return getAppEnv() === "production";
}

/** Throw if production/staging is missing critical configuration. */
export function assertProductionEnv(): void {
  if (!isProductionLike()) return;

  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    missing.push("AUTH_SECRET (>=32 chars)");
  }
  if (!process.env.AUTH_URL && !process.env.NEXTAUTH_URL && !process.env.NEXT_PUBLIC_APP_URL) {
    missing.push("AUTH_URL or NEXTAUTH_URL or NEXT_PUBLIC_APP_URL");
  }
  if (isProduction() && (process.env.STORAGE_PROVIDER || "local") === "local") {
    // Allow local only when explicitly forced for emergency; otherwise require object storage
    if (process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION !== "true") {
      missing.push("STORAGE_PROVIDER (s3) — or set ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true");
    }
  }
  if ((process.env.STORAGE_PROVIDER || "") === "s3") {
    for (const k of ["STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY"]) {
      if (!process.env[k]) missing.push(k);
    }
  }

  if (missing.length) {
    throw new Error(
      `Missing or invalid production environment configuration: ${missing.join(", ")}`
    );
  }
}

export function getMaxUploadBytes(): number {
  const raw = process.env.MAX_UPLOAD_SIZE_BYTES;
  if (raw && Number.isFinite(Number(raw))) return Number(raw);
  return 25 * 1024 * 1024;
}
