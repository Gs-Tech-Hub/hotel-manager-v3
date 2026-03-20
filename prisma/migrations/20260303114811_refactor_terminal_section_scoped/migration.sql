/*
  Warnings:

  - You are about to drop the column `departmentId` on the `terminals` table. All the data in the column will be lost.
  - You are about to drop the column `sectionIds` on the `terminals` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "terminals" DROP CONSTRAINT IF EXISTS "terminals_departmentId_fkey";

-- DropIndex - safe removal if exists
DROP INDEX IF EXISTS "terminals_departmentId_idx";

-- Drop sectionIds only if it exists (add_terminal_support may not have run yet)
ALTER TABLE "terminals" DROP COLUMN IF EXISTS "sectionIds";

-- Add type column if not exists (add_terminal_support may not have run yet)
ALTER TABLE "terminals" ADD COLUMN IF NOT EXISTS "type" TEXT;

-- AlterTable: drop departmentId and add new columns
ALTER TABLE "terminals" DROP COLUMN "departmentId",
ADD COLUMN     "allowedSectionIds" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Set type default to 'section'
ALTER TABLE "terminals" ALTER COLUMN "type" SET DEFAULT 'section';

-- CreateIndex
CREATE INDEX "terminals_type_idx" ON "terminals"("type");

-- CreateIndex
CREATE INDEX "terminals_isDefault_idx" ON "terminals"("isDefault");

-- CreateIndex
CREATE INDEX "terminals_isActive_idx" ON "terminals"("isActive");
