-- Phase 5: Documents & Compliance enhancements

ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "dispatchComplianceMode" TEXT NOT NULL DEFAULT 'WARNING_ONLY';

ALTER TABLE "ComplianceRequirement" ADD COLUMN IF NOT EXISTS "blocksInvoice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ComplianceRequirement" ADD COLUMN IF NOT EXISTS "expirationRequired" BOOLEAN NOT NULL DEFAULT false;

-- Unique entity+type for requirements (dedupe first if needed)
DELETE FROM "ComplianceRequirement" a USING "ComplianceRequirement" b
WHERE a.id > b.id AND a."entityType" = b."entityType" AND a."documentType" = b."documentType";
CREATE UNIQUE INDEX IF NOT EXISTS "ComplianceRequirement_entityType_documentType_key"
  ON "ComplianceRequirement"("entityType", "documentType");

-- CustomerDocument
ALTER TABLE "CustomerDocument" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE "CustomerDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "CustomerDocument" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CustomerDocument" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "CustomerDocument_isCurrent_idx" ON "CustomerDocument"("isCurrent");
CREATE INDEX IF NOT EXISTS "CustomerDocument_status_idx" ON "CustomerDocument"("status");

-- CarrierDocument
ALTER TABLE "CarrierDocument" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE "CarrierDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "CarrierDocument" ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP(3);
ALTER TABLE "CarrierDocument" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CarrierDocument" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "CarrierDocument_isCurrent_idx" ON "CarrierDocument"("isCurrent");
CREATE INDEX IF NOT EXISTS "CarrierDocument_status_idx" ON "CarrierDocument"("status");

-- DriverDocument
ALTER TABLE "DriverDocument" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE "DriverDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "DriverDocument" ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP(3);
ALTER TABLE "DriverDocument" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DriverDocument" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "DriverDocument_documentType_idx" ON "DriverDocument"("documentType");
CREATE INDEX IF NOT EXISTS "DriverDocument_isCurrent_idx" ON "DriverDocument"("isCurrent");
CREATE INDEX IF NOT EXISTS "DriverDocument_status_idx" ON "DriverDocument"("status");

-- EquipmentDocument
ALTER TABLE "EquipmentDocument" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE "EquipmentDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "EquipmentDocument" ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP(3);
ALTER TABLE "EquipmentDocument" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EquipmentDocument" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "EquipmentDocument_documentType_idx" ON "EquipmentDocument"("documentType");
CREATE INDEX IF NOT EXISTS "EquipmentDocument_isCurrent_idx" ON "EquipmentDocument"("isCurrent");
CREATE INDEX IF NOT EXISTS "EquipmentDocument_status_idx" ON "EquipmentDocument"("status");

-- JobDocument
ALTER TABLE "JobDocument" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE "JobDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "JobDocument" ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP(3);
ALTER TABLE "JobDocument" ADD COLUMN IF NOT EXISTS "expirationDate" TIMESTAMP(3);
ALTER TABLE "JobDocument" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "JobDocument" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'VALID';
ALTER TABLE "JobDocument" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "JobDocument_isCurrent_idx" ON "JobDocument"("isCurrent");

-- TruckAssignmentDocument
ALTER TABLE "TruckAssignmentDocument" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE "TruckAssignmentDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "TruckAssignmentDocument" ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP(3);
ALTER TABLE "TruckAssignmentDocument" ADD COLUMN IF NOT EXISTS "expirationDate" TIMESTAMP(3);
ALTER TABLE "TruckAssignmentDocument" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TruckAssignmentDocument" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'VALID';
ALTER TABLE "TruckAssignmentDocument" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "TruckAssignmentDocument_isCurrent_idx" ON "TruckAssignmentDocument"("isCurrent");
CREATE INDEX IF NOT EXISTS "TruckAssignmentDocument_status_idx" ON "TruckAssignmentDocument"("status");
