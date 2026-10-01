import { NextResponse } from "next/server";
import {
  exportJobsCsv,
  exportArAgingCsv,
  exportTruckMovementsCsv,
} from "@/server/reports";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "jobs";
  const preset = url.searchParams.get("preset");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  try {
    let csv = "";
    let filename = "export.csv";
    if (type === "ar-aging") {
      csv = await exportArAgingCsv();
      filename = "ar-aging.csv";
    } else if (type === "trucks") {
      csv = await exportTruckMovementsCsv({ preset, start, end });
      filename = "truck-movements.csv";
    } else {
      csv = await exportJobsCsv({ preset, start, end });
      filename = "jobs.csv";
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    const status = message.includes("Forbidden") || message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
