-- Phase 6 Accounting

-- InvoiceStatus additions
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'NOT_READY';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

-- PayableStatus enum
DO $$ BEGIN
  CREATE TYPE "PayableStatus" AS ENUM ('NOT_READY', 'PAPERWORK_HOLD', 'READY_FOR_APPROVAL', 'APPROVED', 'SCHEDULED', 'PAID', 'DISPUTED', 'VOID');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AccessorialType additions
ALTER TYPE "AccessorialType" ADD VALUE IF NOT EXISTS 'DRIVER_ASSIST';
ALTER TYPE "AccessorialType" ADD VALUE IF NOT EXISTS 'TARP';
ALTER TYPE "AccessorialType" ADD VALUE IF NOT EXISTS 'OVER_DIMENSIONAL';
ALTER TYPE "AccessorialType" ADD VALUE IF NOT EXISTS 'ADDITIONAL_LABOR';

-- Accessorial columns
ALTER TABLE "Accessorial" ADD COLUMN IF NOT EXISTS "customerAmount" DECIMAL(14,2);
ALTER TABLE "Accessorial" ADD COLUMN IF NOT EXISTS "carrierAmount" DECIMAL(14,2);
ALTER TABLE "Accessorial" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Accessorial" ADD COLUMN IF NOT EXISTS "notes" TEXT;
CREATE INDEX IF NOT EXISTS "Accessorial_type_idx" ON "Accessorial"("type");

-- Invoice columns
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "terms" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "accessorialTotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "holdReason" TEXT;

-- CustomerPayment
CREATE TABLE IF NOT EXISTS "CustomerPayment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "amount" DECIMAL(14,2) NOT NULL,
  "paymentMethod" TEXT,
  "referenceNumber" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CustomerPayment_invoiceId_idx" ON "CustomerPayment"("invoiceId");
CREATE INDEX IF NOT EXISTS "CustomerPayment_paymentDate_idx" ON "CustomerPayment"("paymentDate");
DO $$ BEGIN
  ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Settlement extras
ALTER TABLE "CarrierSettlement" ADD COLUMN IF NOT EXISTS "basePay" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "CarrierSettlement" ADD COLUMN IF NOT EXISTS "accessorialPay" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "CarrierSettlement" ADD COLUMN IF NOT EXISTS "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CarrierPayable
CREATE TABLE IF NOT EXISTS "CarrierPayable" (
  "id" TEXT NOT NULL,
  "payableNumber" TEXT NOT NULL,
  "carrierId" TEXT NOT NULL,
  "driverId" TEXT,
  "jobId" TEXT NOT NULL,
  "truckAssignmentId" TEXT NOT NULL,
  "baseRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "accessorialPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalPayable" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "paperworkComplete" BOOLEAN NOT NULL DEFAULT false,
  "paperworkHoldReason" TEXT,
  "status" "PayableStatus" NOT NULL DEFAULT 'NOT_READY',
  "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "paymentDate" TIMESTAMP(3),
  "paymentMethod" TEXT,
  "referenceNumber" TEXT,
  "notes" TEXT,
  "settlementId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CarrierPayable_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CarrierPayable_payableNumber_key" ON "CarrierPayable"("payableNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CarrierPayable_truckAssignmentId_key" ON "CarrierPayable"("truckAssignmentId");
CREATE INDEX IF NOT EXISTS "CarrierPayable_carrierId_idx" ON "CarrierPayable"("carrierId");
CREATE INDEX IF NOT EXISTS "CarrierPayable_jobId_idx" ON "CarrierPayable"("jobId");
CREATE INDEX IF NOT EXISTS "CarrierPayable_status_idx" ON "CarrierPayable"("status");
CREATE INDEX IF NOT EXISTS "CarrierPayable_settlementId_idx" ON "CarrierPayable"("settlementId");
DO $$ BEGIN
  ALTER TABLE "CarrierPayable" ADD CONSTRAINT "CarrierPayable_carrierId_fkey"
    FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "CarrierPayable" ADD CONSTRAINT "CarrierPayable_truckAssignmentId_fkey"
    FOREIGN KEY ("truckAssignmentId") REFERENCES "TruckAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "CarrierPayable" ADD CONSTRAINT "CarrierPayable_settlementId_fkey"
    FOREIGN KEY ("settlementId") REFERENCES "CarrierSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
