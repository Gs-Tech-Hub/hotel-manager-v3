/*
  Warnings:

  - A unique constraint covering the columns `[departmentId,sectionId,inventoryItemId]` on the table `department_inventories` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "department_inventories_departmentId_inventoryItemId_key";

-- AlterTable
ALTER TABLE "department_inventories" ADD COLUMN     "sectionId" TEXT;

-- CreateIndex
CREATE INDEX "department_inventories_sectionId_idx" ON "department_inventories"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "department_inventories_departmentId_sectionId_inventoryItem_key" ON "department_inventories"("departmentId", "sectionId", "inventoryItemId");

-- AddForeignKey
ALTER TABLE "department_inventories" ADD CONSTRAINT "department_inventories_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "department_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
