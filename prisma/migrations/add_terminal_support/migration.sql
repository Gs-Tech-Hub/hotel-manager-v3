-- AlterTable DepartmentSection: Add terminal support
ALTER TABLE "department_sections" ADD COLUMN "hasTerminal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "department_sections" ADD COLUMN "terminalId" TEXT;

-- AlterTable Terminal: Update columns for multi-section support
ALTER TABLE "terminals" ADD COLUMN "description" TEXT;
ALTER TABLE "terminals" ADD COLUMN "sectionIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "terminals" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'sales';

-- Add foreign key constraint for terminalId
ALTER TABLE "department_sections" ADD CONSTRAINT "department_sections_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "department_sections_hasTerminal_idx" ON "department_sections"("hasTerminal");
CREATE INDEX "terminals_status_idx" ON "terminals"("status");
CREATE INDEX "terminals_departmentId_idx" ON "terminals"("departmentId");
