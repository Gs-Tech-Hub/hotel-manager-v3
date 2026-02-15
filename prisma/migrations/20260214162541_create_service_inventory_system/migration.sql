/*
  Warnings:

  - You are about to drop the column `pricePerGame` on the `department_sections` table. All the data in the column will be lost.
  - You are about to drop the column `pricePerHour` on the `department_sections` table. All the data in the column will be lost.
  - You are about to drop the column `pricingModel` on the `department_sections` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "department_sections" DROP COLUMN "pricePerGame",
DROP COLUMN "pricePerHour",
DROP COLUMN "pricingModel";

-- CreateTable
CREATE TABLE "service_inventory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceType" TEXT NOT NULL,
    "pricingModel" TEXT NOT NULL DEFAULT 'per_count',
    "pricePerCount" DECIMAL(10,2),
    "pricePerMinute" DECIMAL(10,4),
    "sectionId" TEXT,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_usage_sessions" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "countUsed" INTEGER NOT NULL DEFAULT 0,
    "minutesUsed" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "orderId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_usage_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_inventory_sectionId_idx" ON "service_inventory"("sectionId");

-- CreateIndex
CREATE INDEX "service_inventory_departmentId_idx" ON "service_inventory"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "service_usage_sessions_orderId_key" ON "service_usage_sessions"("orderId");

-- CreateIndex
CREATE INDEX "service_usage_sessions_customerId_idx" ON "service_usage_sessions"("customerId");

-- CreateIndex
CREATE INDEX "service_usage_sessions_serviceId_idx" ON "service_usage_sessions"("serviceId");

-- CreateIndex
CREATE INDEX "service_usage_sessions_status_idx" ON "service_usage_sessions"("status");

-- AddForeignKey
ALTER TABLE "service_inventory" ADD CONSTRAINT "service_inventory_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "department_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_inventory" ADD CONSTRAINT "service_inventory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_usage_sessions" ADD CONSTRAINT "service_usage_sessions_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_usage_sessions" ADD CONSTRAINT "service_usage_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_usage_sessions" ADD CONSTRAINT "service_usage_sessions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
