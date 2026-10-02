import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Production-safe health check.
 * Does not expose secrets, table names, versions of dependencies, or config values.
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
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
