-- AlterTable
ALTER TABLE "Property" ADD COLUMN "rentalMonths" TEXT NOT NULL DEFAULT '12';
ALTER TABLE "Property" ADD COLUMN "videoTourUrl" TEXT;
ALTER TABLE "Property" ADD COLUMN "ownerDniDocumentUrl" TEXT;
ALTER TABLE "Property" ADD COLUMN "contractOrTitleUrl" TEXT;
