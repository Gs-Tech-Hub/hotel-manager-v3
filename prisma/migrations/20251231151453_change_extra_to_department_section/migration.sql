/*
  Warnings:

  - You are about to drop the column `departmentId` on the `extras` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "extras" DROP CONSTRAINT "extras_departmentId_fkey";

-- DropIndex
DROP INDEX "extras_departmentId_idx";

-- AlterTable
ALTER TABLE "extras" DROP COLUMN "departmentId",
ADD COLUMN     "departmentSectionId" TEXT;

-- CreateIndex
CREATE INDEX "extras_departmentSectionId_idx" ON "extras"("departmentSectionId");

-- AddForeignKey
ALTER TABLE "extras" ADD CONSTRAINT "extras_departmentSectionId_fkey" FOREIGN KEY ("departmentSectionId") REFERENCES "department_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
