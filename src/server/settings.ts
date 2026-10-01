"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/server/audit";
import { ActionError, emptyToNull, parseWithFieldErrors } from "@/lib/validators/form";

const settingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  timezone: z.string().min(1, "Timezone is required").max(100),
  weightUnit: z.enum(["lb", "kg"]).default("lb"),
  distanceUnit: z.enum(["mi", "km"]).default("mi"),
  jobNumberPrefix: z.string().min(1, "Prefix is required").max(20),
  jobNumberIncludeYear: z.coerce.boolean().default(true),
  jobNumberPadWidth: z.coerce.number().int().min(3).max(8).default(6),
  defaultWeightWarningLbs: z.union([z.string(), z.number()]),
  expiresSoonDays: z.coerce.number().int().min(1).max(365).default(30),
});

export async function getCompanySettings() {
  await requireUserPermission("settings:read");
  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }
  return settings;
}

export async function updateCompanySettings(raw: unknown) {
  const session = await requireUserPermission("settings:write");
  const parsed = parseWithFieldErrors(settingsSchema, emptyToNull(raw as Record<string, unknown>));
  if (!parsed.ok) throw new ActionError(parsed.message, parsed.fieldErrors);

  const data = parsed.data;
  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }

  const year = new Date().getFullYear();
  const pad = data.jobNumberPadWidth;
  const previewSeq = settings.nextJobSequence;
  const preview = data.jobNumberIncludeYear
    ? `${data.jobNumberPrefix}-${year}-${String(previewSeq).padStart(pad, "0")}`
    : `${data.jobNumberPrefix}-${String(previewSeq).padStart(pad, "0")}`;

  // Guard: if preview already exists and would be next issued id, bump sequence
  let nextSeq = settings.nextJobSequence;
  for (let i = 0; i < 20; i++) {
    const candidate = data.jobNumberIncludeYear
      ? `${data.jobNumberPrefix}-${year}-${String(nextSeq).padStart(pad, "0")}`
      : `${data.jobNumberPrefix}-${String(nextSeq).padStart(pad, "0")}`;
    const exists = await prisma.job.findFirst({ where: { jobNumber: candidate }, select: { id: true } });
    if (!exists) break;
    nextSeq += 1;
  }

  const updated = await prisma.companySettings.update({
    where: { id: settings.id },
    data: {
      companyName: data.companyName,
      timezone: data.timezone,
      weightUnit: data.weightUnit,
      distanceUnit: data.distanceUnit,
      jobNumberPrefix: data.jobNumberPrefix,
      jobNumberIncludeYear: data.jobNumberIncludeYear,
      jobNumberPadWidth: data.jobNumberPadWidth,
      jobNumberFormat: data.jobNumberIncludeYear
        ? `{PREFIX}-{YYYY}-{${"#".repeat(pad)}}`
        : `{PREFIX}-{${"#".repeat(pad)}}`,
      defaultWeightWarningLbs: new Prisma.Decimal(data.defaultWeightWarningLbs),
      expiresSoonDays: data.expiresSoonDays,
      nextJobSequence: nextSeq,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "settings.updated",
    entityType: "CompanySettings",
    entityId: updated.id,
    newValue: { companyName: updated.companyName, nextPreview: preview },
  });

  revalidatePath("/settings");
  return updated;
}
