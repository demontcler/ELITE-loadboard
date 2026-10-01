-- Phase 7 search/performance indexes
CREATE INDEX IF NOT EXISTS "TruckAssignmentDocument_referenceNumber_idx" ON "TruckAssignmentDocument"("referenceNumber");
CREATE INDEX IF NOT EXISTS "TruckAssignmentDocument_fileName_idx" ON "TruckAssignmentDocument"("fileName");
CREATE INDEX IF NOT EXISTS "CustomerDocument_referenceNumber_idx" ON "CustomerDocument"("referenceNumber");
CREATE INDEX IF NOT EXISTS "CustomerDocument_fileName_idx" ON "CustomerDocument"("fileName");
CREATE INDEX IF NOT EXISTS "JobDocument_referenceNumber_idx" ON "JobDocument"("referenceNumber");
CREATE INDEX IF NOT EXISTS "JobDocument_fileName_idx" ON "JobDocument"("fileName");
CREATE INDEX IF NOT EXISTS "CustomerContact_name_idx" ON "CustomerContact"("name");
CREATE INDEX IF NOT EXISTS "CustomerContact_phone_idx" ON "CustomerContact"("phone");
CREATE INDEX IF NOT EXISTS "Job_customerPoNumber_idx" ON "Job"("customerPoNumber");
CREATE INDEX IF NOT EXISTS "Job_customerReferenceNumber_idx" ON "Job"("customerReferenceNumber");
