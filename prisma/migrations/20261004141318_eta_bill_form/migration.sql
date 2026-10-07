-- CreateEnum
CREATE TYPE "EtaReceiverType" AS ENUM ('B', 'P', 'F');

-- AlterTable
ALTER TABLE "bill_items" ADD COLUMN     "itemType" TEXT;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "buildingNumber" TEXT,
ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT 'EG',
ADD COLUMN     "foreignId" TEXT,
ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "receiverType" "EtaReceiverType" NOT NULL DEFAULT 'B',
ADD COLUMN     "regionCity" TEXT;

-- AlterTable
ALTER TABLE "electronic_bills" ADD COLUMN     "activityCode" TEXT;

-- Backfill: classify existing line codes the way the document builder
-- used to guess them, so old bills keep submitting as before.
UPDATE "bill_items"
SET "itemType" = CASE WHEN upper("gpcCode") LIKE 'EG-%' THEN 'EGS' ELSE 'GS1' END
WHERE "gpcCode" IS NOT NULL AND "itemType" IS NULL;
