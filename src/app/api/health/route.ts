import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BRAND } from "@/lib/branding";

/**
 * Production-safe health check.
 * Does not expose secrets, table names, or sensitive configuration.
 */
export async function GET() {
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const ok = database === "ok";
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      application: "ok",
      database,
      version: BRAND.version,
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
