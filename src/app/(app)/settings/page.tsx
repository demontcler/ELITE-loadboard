import { getCompanySettings, updateCompanySettings } from "@/server/settings";
import { PageHeader } from "@/components/shared/page-chrome";
import { DedicatedEntityForm } from "@/components/forms/dedicated-entity-form";
import { Can } from "@/components/auth/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export default async function SettingsPage() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  const canRead = role ? hasPermission(role, "settings:read") : false;
  const canWrite = role ? hasPermission(role, "settings:write") : false;

  if (!canRead) {
    return (
      <div className="space-y-4">
        <PageHeader title="Settings" description="Company configuration" />
        <Card>
          <CardContent className="py-8 text-sm text-slate-600">
            You do not have permission to view company settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  const settings = await getCompanySettings();
  const year = new Date().getFullYear();
  const pad = settings.jobNumberPadWidth;
  const preview = settings.jobNumberIncludeYear
    ? `${settings.jobNumberPrefix}-${year}-${String(settings.nextJobSequence).padStart(pad, "0")}`
    : `${settings.jobNumberPrefix}-${String(settings.nextJobSequence).padStart(pad, "0")}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Company defaults, job numbering, and operational warning thresholds."
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>Name: {settings.companyName}</div>
            <div>Timezone: {settings.timezone}</div>
            <div>
              Units: {settings.weightUnit} / {settings.distanceUnit}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Job Numbering</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>Next preview: <span className="font-semibold text-slate-900">{preview}</span></div>
            <div>Prefix: {settings.jobNumberPrefix}</div>
            <div>Include year: {settings.jobNumberIncludeYear ? "Yes" : "No"}</div>
            <div>Pad width: {settings.jobNumberPadWidth}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Weight Warning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <div>
              Default threshold:{" "}
              <span className="font-semibold text-slate-900">
                {Number(settings.defaultWeightWarningLbs).toLocaleString()} {settings.weightUnit}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Internal operational warning only — not a legal determination. Per-equipment
              thresholds can be added later without schema redesign.
            </p>
          </CardContent>
        </Card>
      </div>

      <Can permission="settings:write">
        {canWrite ? (
          <DedicatedEntityForm
            title="Edit Company Settings"
            submitLabel="Save Settings"
            redirectTo="/settings"
            defaultValues={{
              companyName: settings.companyName,
              timezone: settings.timezone,
              weightUnit: settings.weightUnit,
              distanceUnit: settings.distanceUnit,
              jobNumberPrefix: settings.jobNumberPrefix,
              jobNumberIncludeYear: settings.jobNumberIncludeYear ? "true" : "false",
              jobNumberPadWidth: String(settings.jobNumberPadWidth),
              defaultWeightWarningLbs: settings.defaultWeightWarningLbs.toString(),
              expiresSoonDays: String(settings.expiresSoonDays),
            }}
            fields={[
              { name: "companyName", label: "Company Name", required: true, section: "Company" },
              {
                name: "timezone",
                label: "Timezone",
                required: true,
                section: "Company",
                options: [
                  { value: "America/Chicago", label: "America/Chicago" },
                  { value: "America/Denver", label: "America/Denver" },
                  { value: "America/New_York", label: "America/New_York" },
                  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
                  { value: "UTC", label: "UTC" },
                ],
              },
              {
                name: "weightUnit",
                label: "Default Weight Unit",
                section: "Units",
                options: [
                  { value: "lb", label: "Pounds (lb)" },
                  { value: "kg", label: "Kilograms (kg)" },
                ],
              },
              {
                name: "distanceUnit",
                label: "Default Distance Unit",
                section: "Units",
                options: [
                  { value: "mi", label: "Miles (mi)" },
                  { value: "km", label: "Kilometers (km)" },
                ],
              },
              {
                name: "jobNumberPrefix",
                label: "Job Number Prefix",
                required: true,
                section: "Job Numbering",
              },
              {
                name: "jobNumberIncludeYear",
                label: "Include Year",
                section: "Job Numbering",
                options: [
                  { value: "true", label: "Yes (JOB-2026-000184)" },
                  { value: "false", label: "No (JOB-000184)" },
                ],
              },
              {
                name: "jobNumberPadWidth",
                label: "Sequence Digits",
                type: "number",
                section: "Job Numbering",
              },
              {
                name: "defaultWeightWarningLbs",
                label: "Default Weight Warning Threshold",
                type: "number",
                required: true,
                section: "Operational Warnings",
              },
              {
                name: "expiresSoonDays",
                label: "Expires-Soon Days",
                type: "number",
                section: "Operational Warnings",
              },
            ]}
            onSubmit={async (data) => {
              "use server";
              return updateCompanySettings({
                ...data,
                jobNumberIncludeYear: data.jobNumberIncludeYear === "true",
              });
            }}
          />
        ) : null}
      </Can>
    </div>
  );
}
