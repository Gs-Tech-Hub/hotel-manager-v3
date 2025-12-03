/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `department_sections` will be added. If there are existing duplicate values, this will fail.
  - Made the column `isActive` on table `department_sections` required. This step will fail if there are existing NULL values in that column.
  - Made the column `isActive` on table `inventory_items` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "department_sections" DROP CONSTRAINT "department_sections_department_fkey";

-- AlterTable
ALTER TABLE "admin_audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "department_sections" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "isActive" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_items" ALTER COLUMN "isActive" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "department_sections_slug_key" ON "department_sections"("slug");

-- AddForeignKey
ALTER TABLE "department_sections" ADD CONSTRAINT "department_sections_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
