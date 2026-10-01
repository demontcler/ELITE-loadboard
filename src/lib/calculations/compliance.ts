export type DocComplianceStatus = "VALID" | "EXPIRES_SOON" | "EXPIRED" | "MISSING";

export function evaluateDocumentStatus(
  expirationDate: Date | null | undefined,
  expiresSoonDays: number = 30,
  now: Date = new Date()
): DocComplianceStatus {
  if (!expirationDate) return "VALID";

  const exp = new Date(expirationDate);
  exp.setHours(23, 59, 59, 999);

  if (exp.getTime() < now.getTime()) {
    return "EXPIRED";
  }

  const soon = new Date(now);
  soon.setDate(soon.getDate() + expiresSoonDays);

  if (exp.getTime() <= soon.getTime()) {
    return "EXPIRES_SOON";
  }

  return "VALID";
}

export function isComplianceBlocking(status: DocComplianceStatus): boolean {
  return status === "EXPIRED" || status === "MISSING";
}
