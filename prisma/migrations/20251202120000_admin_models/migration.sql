-- Migration: Add DepartmentSection and AdminAuditLog; soft-delete InventoryItem

BEGIN;

-- Add department_sections table
CREATE TABLE IF NOT EXISTS "department_sections" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "departmentId" TEXT NOT NULL,
  "metadata" JSONB DEFAULT '{}',
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMP(3) DEFAULT now() NOT NULL
);

ALTER TABLE IF EXISTS "department_sections" ADD CONSTRAINT department_sections_department_fkey FOREIGN KEY ("departmentId") REFERENCES "departments"(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "department_sections_departmentId_idx" ON "department_sections" ("departmentId");

-- Add admin_audit_logs table
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" TEXT,
  "actorType" TEXT,
  "action" TEXT NOT NULL,
  "subject" TEXT,
  "subjectId" TEXT,
  "details" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "admin_audit_logs_actorId_idx" ON "admin_audit_logs" ("actorId");

-- Add isActive and deletedAt to inventory_items
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='isActive') THEN
    ALTER TABLE "inventory_items" ADD COLUMN "isActive" BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='deletedAt') THEN
    ALTER TABLE "inventory_items" ADD COLUMN "deletedAt" TIMESTAMP(3);
  END IF;
END$$;

COMMIT;
