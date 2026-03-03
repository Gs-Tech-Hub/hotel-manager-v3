/*
  Warnings:

  - You are about to drop the column `departmentId` on the `terminals` table. All the data in the column will be lost.
  - You are about to drop the column `sectionIds` on the `terminals` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "terminals" DROP CONSTRAINT "terminals_departmentId_fkey";

-- DropIndex
DROP INDEX "terminals_departmentId_idx";

-- AlterTable
ALTER TABLE "terminals" DROP COLUMN "departmentId",
DROP COLUMN "sectionIds",
ADD COLUMN     "allowedSectionIds" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "type" SET DEFAULT 'section';

-- CreateIndex
CREATE INDEX "terminals_type_idx" ON "terminals"("type");

-- CreateIndex
CREATE INDEX "terminals_isDefault_idx" ON "terminals"("isDefault");

-- CreateIndex
CREATE INDEX "terminals_isActive_idx" ON "terminals"("isActive");
