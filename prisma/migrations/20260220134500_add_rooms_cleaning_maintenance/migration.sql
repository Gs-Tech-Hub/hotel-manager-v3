/*
  Warnings:

  - You are about to drop the column `orderId` on the `game_sessions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[orderHeaderId]` on the table `game_sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('ROOM', 'SUITE', 'APARTMENT');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CleaningTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'INSPECTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CleaningPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- DropForeignKey
ALTER TABLE "game_sessions" DROP CONSTRAINT "game_sessions_orderId_fkey";

-- DropIndex
DROP INDEX "game_sessions_orderId_key";

-- AlterTable
ALTER TABLE "game_sessions" DROP COLUMN "orderId",
ADD COLUMN     "orderHeaderId" TEXT;

-- CreateTable
CREATE TABLE "room_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "amenities" JSONB,
    "basePriceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "unitKind" "UnitKind" NOT NULL DEFAULT 'ROOM',
    "roomTypeId" TEXT NOT NULL,
    "departmentId" TEXT,
    "status" "UnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "idNumber" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "confirmationNo" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "totalPriceCents" INTEGER NOT NULL,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "source" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_overrides" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "pricePerNightCents" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_tasks" (
    "id" TEXT NOT NULL,
    "taskNumber" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "priority" "CleaningPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "CleaningTaskStatus" NOT NULL DEFAULT 'PENDING',
    "taskType" TEXT NOT NULL,
    "assignedToId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    "inspectedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleaning_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_logs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "loggedById" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cleaning_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" TEXT NOT NULL,
    "workOrderNo" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "estimatedCostCents" INTEGER,
    "actualCostCents" INTEGER,
    "estimatedDays" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "loggedById" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL,
    "workDescription" TEXT NOT NULL,
    "partsUsed" TEXT,
    "laborHoursCents" INTEGER,
    "costCents" INTEGER,
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_status_history" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "previousStatus" "UnitStatus" NOT NULL,
    "newStatus" "UnitStatus" NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_types_code_key" ON "room_types"("code");

-- CreateIndex
CREATE INDEX "room_types_code_idx" ON "room_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "units_roomNumber_key" ON "units"("roomNumber");

-- CreateIndex
CREATE INDEX "units_roomTypeId_idx" ON "units"("roomTypeId");

-- CreateIndex
CREATE INDEX "units_departmentId_idx" ON "units"("departmentId");

-- CreateIndex
CREATE INDEX "units_status_idx" ON "units"("status");

-- CreateIndex
CREATE INDEX "units_roomNumber_idx" ON "units"("roomNumber");

-- CreateIndex
CREATE UNIQUE INDEX "guests_email_key" ON "guests"("email");

-- CreateIndex
CREATE INDEX "guests_email_idx" ON "guests"("email");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_confirmationNo_key" ON "reservations"("confirmationNo");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_idempotencyKey_key" ON "reservations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "reservations_unitId_idx" ON "reservations"("unitId");

-- CreateIndex
CREATE INDEX "reservations_guestId_idx" ON "reservations"("guestId");

-- CreateIndex
CREATE INDEX "reservations_checkInDate_checkOutDate_idx" ON "reservations"("checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_unitId_checkInDate_checkOutDate_key" ON "reservations"("unitId", "checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "pricing_overrides_roomTypeId_startDate_endDate_idx" ON "pricing_overrides"("roomTypeId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "cleaning_tasks_taskNumber_key" ON "cleaning_tasks"("taskNumber");

-- CreateIndex
CREATE INDEX "cleaning_tasks_unitId_idx" ON "cleaning_tasks"("unitId");

-- CreateIndex
CREATE INDEX "cleaning_tasks_status_idx" ON "cleaning_tasks"("status");

-- CreateIndex
CREATE INDEX "cleaning_tasks_assignedToId_idx" ON "cleaning_tasks"("assignedToId");

-- CreateIndex
CREATE INDEX "cleaning_tasks_createdAt_idx" ON "cleaning_tasks"("createdAt");

-- CreateIndex
CREATE INDEX "cleaning_logs_taskId_idx" ON "cleaning_logs"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_requests_workOrderNo_key" ON "maintenance_requests"("workOrderNo");

-- CreateIndex
CREATE INDEX "maintenance_requests_unitId_idx" ON "maintenance_requests"("unitId");

-- CreateIndex
CREATE INDEX "maintenance_requests_status_idx" ON "maintenance_requests"("status");

-- CreateIndex
CREATE INDEX "maintenance_requests_assignedToId_idx" ON "maintenance_requests"("assignedToId");

-- CreateIndex
CREATE INDEX "maintenance_requests_priority_idx" ON "maintenance_requests"("priority");

-- CreateIndex
CREATE INDEX "maintenance_requests_createdAt_idx" ON "maintenance_requests"("createdAt");

-- CreateIndex
CREATE INDEX "maintenance_logs_requestId_idx" ON "maintenance_logs"("requestId");

-- CreateIndex
CREATE INDEX "unit_status_history_unitId_changedAt_idx" ON "unit_status_history"("unitId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_orderHeaderId_key" ON "game_sessions"("orderHeaderId");

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_orderHeaderId_fkey" FOREIGN KEY ("orderHeaderId") REFERENCES "order_headers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_overrides" ADD CONSTRAINT "pricing_overrides_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_logs" ADD CONSTRAINT "cleaning_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "cleaning_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_status_history" ADD CONSTRAINT "unit_status_history_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
