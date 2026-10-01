-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DISPATCHER', 'ACCOUNTING', 'OPERATIONS_MANAGER', 'VIEW_ONLY');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'RESTRICTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PaymentTerms" AS ENUM ('DUE_ON_RECEIPT', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CarrierApprovalStatus" AS ENUM ('PREFERRED', 'APPROVED', 'PENDING', 'RESTRICTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DriverType" AS ENUM ('COMPANY', 'OWNER_OPERATOR', 'CARRIER', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'OFF_DUTY', 'INACTIVE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "TrailerType" AS ENUM ('FLATBED', 'STEP_DECK', 'DOUBLE_DROP', 'RGN', 'HOTSHOT', 'PIPE_TRAILER', 'OTHER');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('OILFIELD', 'PIPE', 'FLATBED', 'EQUIPMENT', 'RIG_MATERIALS', 'MULTI_TRUCK_PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingMethod" AS ENUM ('PER_LOAD', 'PER_TRUCK', 'PER_MILE', 'PER_HOUR', 'FLAT_RATE', 'PER_FOOT', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'NEEDS_TRUCKS', 'PARTIALLY_ASSIGNED', 'READY', 'DISPATCHED', 'PARTIALLY_DISPATCHED', 'IN_TRANSIT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TruckAssignmentStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'CONFIRMED', 'DISPATCHED', 'ARRIVED_PICKUP', 'LOADING', 'LOADED', 'IN_TRANSIT', 'ARRIVED_DELIVERY', 'UNLOADING', 'DELIVERED', 'POD_RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('CASING', 'TUBING', 'DRILL_PIPE', 'PRODUCTION_EQUIPMENT', 'RIG_EQUIPMENT', 'VALVES', 'SPOOLS', 'SKIDS', 'TANKS', 'PUMPS', 'GENERATORS', 'OILFIELD_TOOLS', 'FLATBED_FREIGHT', 'MISCELLANEOUS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'READY_TO_INVOICE', 'SENT', 'PARTIAL_PAYMENT', 'PAID', 'OVERDUE', 'DISPUTED', 'VOID');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'DOCUMENTS_PENDING', 'READY_FOR_PAYMENT', 'APPROVED', 'PAID', 'ON_HOLD', 'VOID');

-- CreateEnum
CREATE TYPE "AccessorialType" AS ENUM ('DETENTION', 'LAYOVER', 'TONU', 'FUEL_SURCHARGE', 'LUMPER', 'EXTRA_STOP', 'PERMIT', 'ESCORT', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEW_ONLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'ELITE Logistics',
    "jobNumberPrefix" TEXT NOT NULL DEFAULT 'JOB',
    "jobNumberFormat" TEXT NOT NULL DEFAULT '{PREFIX}-{YYYY}-{######}',
    "truckNumberPrefix" TEXT NOT NULL DEFAULT 'TRK',
    "invoiceNumberPrefix" TEXT NOT NULL DEFAULT 'INV',
    "settlementNumberPrefix" TEXT NOT NULL DEFAULT 'SET',
    "nextJobSequence" INTEGER NOT NULL DEFAULT 1,
    "nextInvoiceSequence" INTEGER NOT NULL DEFAULT 1,
    "nextSettlementSequence" INTEGER NOT NULL DEFAULT 1,
    "defaultWeightWarningLbs" DECIMAL(12,2) NOT NULL DEFAULT 48000,
    "expiresSoonDays" INTEGER NOT NULL DEFAULT 30,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRequirement" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "blocksPayment" BOOLEAN NOT NULL DEFAULT false,
    "warningDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "dba" TEXT,
    "billingAddress1" TEXT,
    "billingAddress2" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingZip" TEXT,
    "physicalAddress1" TEXT,
    "physicalAddress2" TEXT,
    "physicalCity" TEXT,
    "physicalState" TEXT,
    "physicalZip" TEXT,
    "mainPhone" TEXT,
    "website" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "paymentTerms" "PaymentTerms" NOT NULL DEFAULT 'NET_30',
    "creditLimit" DECIMAL(14,2),
    "taxId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerLocation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationType" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "county" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "leaseName" TEXT,
    "wellName" TEXT,
    "rigName" TEXT,
    "rigNumber" TEXT,
    "gateInstructions" TEXT,
    "directions" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDocument" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "notes" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "dba" TEXT,
    "mcNumber" TEXT,
    "usdotNumber" TEXT,
    "taxId" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "paymentTerms" "PaymentTerms" NOT NULL DEFAULT 'NET_30',
    "preferredPaymentMethod" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "approvalStatus" "CarrierApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "safetyNotes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierContact" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CarrierContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierDocument" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CarrierDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "carrierId" TEXT,
    "driverType" "DriverType" NOT NULL DEFAULT 'CARRIER',
    "cdlNumber" TEXT,
    "cdlState" TEXT,
    "cdlClass" TEXT,
    "cdlExpiration" TIMESTAMP(3),
    "medicalCardExpiration" TIMESTAMP(3),
    "twicNumber" TEXT,
    "twicExpiration" TIMESTAMP(3),
    "status" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignedTractorId" TEXT,
    "assignedTrailerId" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverDocument" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DriverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tractor" (
    "id" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "vin" TEXT,
    "licensePlate" TEXT,
    "licenseState" TEXT,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "carrierId" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trailer" (
    "id" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "vin" TEXT,
    "licensePlate" TEXT,
    "licenseState" TEXT,
    "trailerType" "TrailerType" NOT NULL DEFAULT 'FLATBED',
    "customType" TEXT,
    "lengthFeet" DECIMAL(6,2),
    "axles" INTEGER,
    "maxPayloadLbs" DECIMAL(12,2),
    "carrierId" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Trailer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentDocument" (
    "id" TEXT NOT NULL,
    "tractorId" TEXT,
    "trailerId" TEXT,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EquipmentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerPoNumber" TEXT,
    "customerReferenceNumber" TEXT,
    "orderNumber" TEXT,
    "requestedBy" TEXT,
    "customerContactId" TEXT,
    "customerContactName" TEXT,
    "customerContactPhone" TEXT,
    "jobType" "JobType" NOT NULL DEFAULT 'OILFIELD',
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "pickupDate" TIMESTAMP(3),
    "pickupTime" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "deliveryTime" TEXT,
    "pickupName" TEXT,
    "pickupAddress1" TEXT,
    "pickupAddress2" TEXT,
    "pickupCity" TEXT,
    "pickupState" TEXT,
    "pickupZip" TEXT,
    "pickupCounty" TEXT,
    "pickupLatitude" DECIMAL(10,7),
    "pickupLongitude" DECIMAL(10,7),
    "pickupDirections" TEXT,
    "pickupGateInstructions" TEXT,
    "pickupContactName" TEXT,
    "pickupContactPhone" TEXT,
    "deliveryName" TEXT,
    "deliveryAddress1" TEXT,
    "deliveryAddress2" TEXT,
    "deliveryCity" TEXT,
    "deliveryState" TEXT,
    "deliveryZip" TEXT,
    "deliveryCounty" TEXT,
    "deliveryLatitude" DECIMAL(10,7),
    "deliveryLongitude" DECIMAL(10,7),
    "deliveryDirections" TEXT,
    "deliveryGateInstructions" TEXT,
    "deliveryContactName" TEXT,
    "deliveryContactPhone" TEXT,
    "rigName" TEXT,
    "rigNumber" TEXT,
    "leaseName" TEXT,
    "wellName" TEXT,
    "afeNumber" TEXT,
    "fieldContactName" TEXT,
    "fieldContactPhone" TEXT,
    "specialInstructions" TEXT,
    "trucksRequired" INTEGER NOT NULL DEFAULT 1,
    "equipmentRequirements" TEXT,
    "customerRate" DECIMAL(14,2),
    "billingMethod" "BillingMethod" NOT NULL DEFAULT 'PER_TRUCK',
    "notes" TEXT,
    "totalRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAdditionalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "marginPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "dispatcherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruckAssignment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "assignmentNumber" INTEGER NOT NULL,
    "displayId" TEXT NOT NULL,
    "carrierId" TEXT,
    "driverId" TEXT,
    "driverPhone" TEXT,
    "tractorId" TEXT,
    "trailerId" TEXT,
    "trailerType" "TrailerType",
    "equipmentType" TEXT,
    "pickupDate" TIMESTAMP(3),
    "pickupTime" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "deliveryTime" TEXT,
    "status" "TruckAssignmentStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "carrierRate" DECIMAL(14,2),
    "driverRate" DECIMAL(14,2),
    "accessorialTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "revenueAllocation" DECIMAL(14,2),
    "additionalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "marginPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "totalFootage" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "totalWeightLbs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "weightWarning" BOOLEAN NOT NULL DEFAULT false,
    "dispatcherId" TEXT,
    "notes" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TruckAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoItem" (
    "id" TEXT NOT NULL,
    "truckAssignmentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "materialCategory" "MaterialCategory" NOT NULL DEFAULT 'CUSTOM',
    "materialDescription" TEXT NOT NULL,
    "pipeType" TEXT,
    "pipeGrade" TEXT,
    "pipeOutsideDiameterIn" DECIMAL(8,4),
    "wallThicknessIn" DECIMAL(8,4),
    "jointLengthFt" DECIMAL(10,3),
    "numberOfJoints" INTEGER,
    "totalFootage" DECIMAL(14,3),
    "weightPerFoot" DECIMAL(10,4),
    "calculatedWeightLbs" DECIMAL(14,2),
    "manualWeightOverrideLbs" DECIMAL(14,2),
    "heatNumber" TEXT,
    "bundleCount" INTEGER,
    "quantity" DECIMAL(14,3),
    "unit" TEXT,
    "customerMaterialRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CargoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDocument" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "JobDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruckAssignmentDocument" (
    "id" TEXT NOT NULL,
    "truckAssignmentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TruckAssignmentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accessorial" (
    "id" TEXT NOT NULL,
    "truckAssignmentId" TEXT NOT NULL,
    "type" "AccessorialType" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "billToCustomer" BOOLEAN NOT NULL DEFAULT true,
    "payToCarrier" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Accessorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jobId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "invoiceAmount" DECIMAL(14,2) NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(14,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierSettlement" (
    "id" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "driverId" TEXT,
    "jobId" TEXT,
    "truckAssignmentId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "documentsComplete" BOOLEAN NOT NULL DEFAULT false,
    "paymentApproved" BOOLEAN NOT NULL DEFAULT false,
    "paymentDate" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "holdReason" TEXT,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CarrierSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementLineItem" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "linkUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "ComplianceRequirement_entityType_isActive_idx" ON "ComplianceRequirement"("entityType", "isActive");

-- CreateIndex
CREATE INDEX "Customer_companyName_idx" ON "Customer"("companyName");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");

-- CreateIndex
CREATE INDEX "CustomerContact_customerId_idx" ON "CustomerContact"("customerId");

-- CreateIndex
CREATE INDEX "CustomerLocation_customerId_idx" ON "CustomerLocation"("customerId");

-- CreateIndex
CREATE INDEX "CustomerLocation_rigName_idx" ON "CustomerLocation"("rigName");

-- CreateIndex
CREATE INDEX "CustomerLocation_leaseName_idx" ON "CustomerLocation"("leaseName");

-- CreateIndex
CREATE INDEX "CustomerLocation_wellName_idx" ON "CustomerLocation"("wellName");

-- CreateIndex
CREATE INDEX "CustomerDocument_customerId_idx" ON "CustomerDocument"("customerId");

-- CreateIndex
CREATE INDEX "CustomerDocument_expirationDate_idx" ON "CustomerDocument"("expirationDate");

-- CreateIndex
CREATE INDEX "CustomerDocument_documentType_idx" ON "CustomerDocument"("documentType");

-- CreateIndex
CREATE INDEX "Carrier_legalName_idx" ON "Carrier"("legalName");

-- CreateIndex
CREATE INDEX "Carrier_mcNumber_idx" ON "Carrier"("mcNumber");

-- CreateIndex
CREATE INDEX "Carrier_usdotNumber_idx" ON "Carrier"("usdotNumber");

-- CreateIndex
CREATE INDEX "Carrier_status_idx" ON "Carrier"("status");

-- CreateIndex
CREATE INDEX "Carrier_deletedAt_idx" ON "Carrier"("deletedAt");

-- CreateIndex
CREATE INDEX "CarrierContact_carrierId_idx" ON "CarrierContact"("carrierId");

-- CreateIndex
CREATE INDEX "CarrierDocument_carrierId_idx" ON "CarrierDocument"("carrierId");

-- CreateIndex
CREATE INDEX "CarrierDocument_expirationDate_idx" ON "CarrierDocument"("expirationDate");

-- CreateIndex
CREATE INDEX "CarrierDocument_documentType_idx" ON "CarrierDocument"("documentType");

-- CreateIndex
CREATE INDEX "Driver_lastName_firstName_idx" ON "Driver"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Driver_carrierId_idx" ON "Driver"("carrierId");

-- CreateIndex
CREATE INDEX "Driver_phone_idx" ON "Driver"("phone");

-- CreateIndex
CREATE INDEX "Driver_status_idx" ON "Driver"("status");

-- CreateIndex
CREATE INDEX "Driver_deletedAt_idx" ON "Driver"("deletedAt");

-- CreateIndex
CREATE INDEX "DriverDocument_driverId_idx" ON "DriverDocument"("driverId");

-- CreateIndex
CREATE INDEX "DriverDocument_expirationDate_idx" ON "DriverDocument"("expirationDate");

-- CreateIndex
CREATE INDEX "Tractor_unitNumber_idx" ON "Tractor"("unitNumber");

-- CreateIndex
CREATE INDEX "Tractor_status_idx" ON "Tractor"("status");

-- CreateIndex
CREATE INDEX "Tractor_deletedAt_idx" ON "Tractor"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tractor_carrierId_unitNumber_key" ON "Tractor"("carrierId", "unitNumber");

-- CreateIndex
CREATE INDEX "Trailer_unitNumber_idx" ON "Trailer"("unitNumber");

-- CreateIndex
CREATE INDEX "Trailer_trailerType_idx" ON "Trailer"("trailerType");

-- CreateIndex
CREATE INDEX "Trailer_status_idx" ON "Trailer"("status");

-- CreateIndex
CREATE INDEX "Trailer_deletedAt_idx" ON "Trailer"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trailer_carrierId_unitNumber_key" ON "Trailer"("carrierId", "unitNumber");

-- CreateIndex
CREATE INDEX "EquipmentDocument_tractorId_idx" ON "EquipmentDocument"("tractorId");

-- CreateIndex
CREATE INDEX "EquipmentDocument_trailerId_idx" ON "EquipmentDocument"("trailerId");

-- CreateIndex
CREATE INDEX "EquipmentDocument_expirationDate_idx" ON "EquipmentDocument"("expirationDate");

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");

-- CreateIndex
CREATE INDEX "Job_customerId_idx" ON "Job"("customerId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_pickupDate_idx" ON "Job"("pickupDate");

-- CreateIndex
CREATE INDEX "Job_deliveryDate_idx" ON "Job"("deliveryDate");

-- CreateIndex
CREATE INDEX "Job_rigName_idx" ON "Job"("rigName");

-- CreateIndex
CREATE INDEX "Job_leaseName_idx" ON "Job"("leaseName");

-- CreateIndex
CREATE INDEX "Job_wellName_idx" ON "Job"("wellName");

-- CreateIndex
CREATE INDEX "Job_dispatcherId_idx" ON "Job"("dispatcherId");

-- CreateIndex
CREATE INDEX "Job_deletedAt_idx" ON "Job"("deletedAt");

-- CreateIndex
CREATE INDEX "Job_jobNumber_idx" ON "Job"("jobNumber");

-- CreateIndex
CREATE INDEX "TruckAssignment_jobId_idx" ON "TruckAssignment"("jobId");

-- CreateIndex
CREATE INDEX "TruckAssignment_carrierId_idx" ON "TruckAssignment"("carrierId");

-- CreateIndex
CREATE INDEX "TruckAssignment_driverId_idx" ON "TruckAssignment"("driverId");

-- CreateIndex
CREATE INDEX "TruckAssignment_status_idx" ON "TruckAssignment"("status");

-- CreateIndex
CREATE INDEX "TruckAssignment_pickupDate_idx" ON "TruckAssignment"("pickupDate");

-- CreateIndex
CREATE INDEX "TruckAssignment_deletedAt_idx" ON "TruckAssignment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TruckAssignment_jobId_assignmentNumber_key" ON "TruckAssignment"("jobId", "assignmentNumber");

-- CreateIndex
CREATE INDEX "CargoItem_truckAssignmentId_idx" ON "CargoItem"("truckAssignmentId");

-- CreateIndex
CREATE INDEX "CargoItem_materialCategory_idx" ON "CargoItem"("materialCategory");

-- CreateIndex
CREATE INDEX "CargoItem_materialDescription_idx" ON "CargoItem"("materialDescription");

-- CreateIndex
CREATE INDEX "JobDocument_jobId_idx" ON "JobDocument"("jobId");

-- CreateIndex
CREATE INDEX "JobDocument_documentType_idx" ON "JobDocument"("documentType");

-- CreateIndex
CREATE INDEX "TruckAssignmentDocument_truckAssignmentId_idx" ON "TruckAssignmentDocument"("truckAssignmentId");

-- CreateIndex
CREATE INDEX "TruckAssignmentDocument_documentType_idx" ON "TruckAssignmentDocument"("documentType");

-- CreateIndex
CREATE INDEX "Accessorial_truckAssignmentId_idx" ON "Accessorial"("truckAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_jobId_idx" ON "Invoice"("jobId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierSettlement_settlementNumber_key" ON "CarrierSettlement"("settlementNumber");

-- CreateIndex
CREATE INDEX "CarrierSettlement_carrierId_idx" ON "CarrierSettlement"("carrierId");

-- CreateIndex
CREATE INDEX "CarrierSettlement_truckAssignmentId_idx" ON "CarrierSettlement"("truckAssignmentId");

-- CreateIndex
CREATE INDEX "CarrierSettlement_status_idx" ON "CarrierSettlement"("status");

-- CreateIndex
CREATE INDEX "CarrierSettlement_settlementNumber_idx" ON "CarrierSettlement"("settlementNumber");

-- CreateIndex
CREATE INDEX "SettlementLineItem_settlementId_idx" ON "SettlementLineItem"("settlementId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLocation" ADD CONSTRAINT "CustomerLocation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierContact" ADD CONSTRAINT "CarrierContact_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierDocument" ADD CONSTRAINT "CarrierDocument_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverDocument" ADD CONSTRAINT "DriverDocument_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tractor" ADD CONSTRAINT "Tractor_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trailer" ADD CONSTRAINT "Trailer_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentDocument" ADD CONSTRAINT "EquipmentDocument_tractorId_fkey" FOREIGN KEY ("tractorId") REFERENCES "Tractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentDocument" ADD CONSTRAINT "EquipmentDocument_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "Trailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_dispatcherId_fkey" FOREIGN KEY ("dispatcherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckAssignment" ADD CONSTRAINT "TruckAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckAssignment" ADD CONSTRAINT "TruckAssignment_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckAssignment" ADD CONSTRAINT "TruckAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckAssignment" ADD CONSTRAINT "TruckAssignment_tractorId_fkey" FOREIGN KEY ("tractorId") REFERENCES "Tractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckAssignment" ADD CONSTRAINT "TruckAssignment_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "Trailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckAssignment" ADD CONSTRAINT "TruckAssignment_dispatcherId_fkey" FOREIGN KEY ("dispatcherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoItem" ADD CONSTRAINT "CargoItem_truckAssignmentId_fkey" FOREIGN KEY ("truckAssignmentId") REFERENCES "TruckAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDocument" ADD CONSTRAINT "JobDocument_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckAssignmentDocument" ADD CONSTRAINT "TruckAssignmentDocument_truckAssignmentId_fkey" FOREIGN KEY ("truckAssignmentId") REFERENCES "TruckAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accessorial" ADD CONSTRAINT "Accessorial_truckAssignmentId_fkey" FOREIGN KEY ("truckAssignmentId") REFERENCES "TruckAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierSettlement" ADD CONSTRAINT "CarrierSettlement_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierSettlement" ADD CONSTRAINT "CarrierSettlement_truckAssignmentId_fkey" FOREIGN KEY ("truckAssignmentId") REFERENCES "TruckAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLineItem" ADD CONSTRAINT "SettlementLineItem_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "CarrierSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
