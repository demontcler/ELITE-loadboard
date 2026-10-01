import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@prisma/client";
import { getDocumentBuffer } from "@/server/documents";
import type { DocumentOwnerType } from "@/lib/documents/types";

const OWNERS = new Set([
  "JOB",
  "TRUCK_ASSIGNMENT",
  "CUSTOMER",
  "CARRIER",
  "DRIVER",
  "TRACTOR",
  "TRAILER",
]);

export async function GET(
  _req: Request,
  context: { params: Promise<{ ownerType: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "documents:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { ownerType: raw, id } = await context.params;
  const ownerType = raw.toUpperCase() as DocumentOwnerType;
  if (!OWNERS.has(ownerType)) {
    return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
  }

  try {
    const file = await getDocumentBuffer(ownerType, id);
    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Not found";
    const status = message.includes("Forbidden") ? 403 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}
