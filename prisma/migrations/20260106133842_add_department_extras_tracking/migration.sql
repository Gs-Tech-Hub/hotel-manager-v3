-- AlterTable
ALTER TABLE "extras" ADD COLUMN     "departmentId" TEXT;

-- CreateTable
CREATE TABLE "department_extras" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "sectionId" TEXT,
    "extraId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_extras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_extras_departmentId_idx" ON "department_extras"("departmentId");

-- CreateIndex
CREATE INDEX "department_extras_sectionId_idx" ON "department_extras"("sectionId");

-- CreateIndex
CREATE INDEX "department_extras_extraId_idx" ON "department_extras"("extraId");

-- CreateIndex
CREATE UNIQUE INDEX "department_extras_departmentId_sectionId_extraId_key" ON "department_extras"("departmentId", "sectionId", "extraId");

-- CreateIndex
CREATE INDEX "extras_departmentId_idx" ON "extras"("departmentId");

-- AddForeignKey
ALTER TABLE "extras" ADD CONSTRAINT "extras_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_extras" ADD CONSTRAINT "department_extras_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_extras" ADD CONSTRAINT "department_extras_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "department_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_extras" ADD CONSTRAINT "department_extras_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "extras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
