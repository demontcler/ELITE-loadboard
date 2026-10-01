-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "distanceUnit" TEXT NOT NULL DEFAULT 'mi',
ADD COLUMN     "jobNumberIncludeYear" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "jobNumberPadWidth" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "weightUnit" TEXT NOT NULL DEFAULT 'lb';
