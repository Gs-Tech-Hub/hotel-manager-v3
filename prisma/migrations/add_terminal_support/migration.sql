-- AlterTable DepartmentSection: Add terminal support
ALTER TABLE "department_sections" ADD COLUMN IF NOT EXISTS "hasTerminal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "department_sections" ADD COLUMN IF NOT EXISTS "terminalId" TEXT;

-- AlterTable Terminal: Update columns for multi-section support (IF NOT EXISTS: refactor may have run first)
ALTER TABLE "terminals" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "terminals" ADD COLUMN IF NOT EXISTS "sectionIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "terminals" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'sales';

-- Add foreign key constraint for terminalId (IF NOT EXISTS for idempotency)
ALTER TABLE "department_sections" DROP CONSTRAINT IF EXISTS "department_sections_terminalId_fkey";
ALTER TABLE "department_sections" ADD CONSTRAINT "department_sections_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes (departmentId_idx only if column exists - refactor may have dropped it)
CREATE INDEX IF NOT EXISTS "department_sections_hasTerminal_idx" ON "department_sections"("hasTerminal");
CREATE INDEX IF NOT EXISTS "terminals_status_idx" ON "terminals"("status");
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'terminals' AND column_name = 'departmentId') THEN
    CREATE INDEX IF NOT EXISTS "terminals_departmentId_idx" ON "terminals"("departmentId");
  END IF;
END $$;
