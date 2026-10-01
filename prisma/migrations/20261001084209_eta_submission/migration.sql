-- AlterTable
ALTER TABLE "electronic_bills" ADD COLUMN     "etaCheckedAt" TIMESTAMPTZ(3),
ADD COLUMN     "etaErrors" JSONB,
ADD COLUMN     "etaSubmissionId" TEXT;
