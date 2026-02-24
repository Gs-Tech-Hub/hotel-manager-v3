/*
  Warnings:

  - You are about to drop the column `roomId` on the `bookings` table. All the data in the column will be lost.
  - Added the required column `unitId` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CleaningRoutineType" AS ENUM ('TURNOVER', 'DEEP', 'MAINTENANCE', 'TOUCH_UP', 'LINEN_CHANGE', 'NIGHT_AUDIT');

-- CreateEnum
CREATE TYPE "CleaningFrequency" AS ENUM ('EVERY_CHECKOUT', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'AS_NEEDED');

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_roomId_fkey";

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "roomId",
ADD COLUMN     "unitId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "cleaning_tasks" ADD COLUMN     "routineId" TEXT;

-- CreateTable
CREATE TABLE "cleaning_routines" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CleaningRoutineType" NOT NULL,
    "frequency" "CleaningFrequency" NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "priority" "CleaningPriority" NOT NULL DEFAULT 'NORMAL',
    "checklist" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleaning_routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CleaningRoutineRoomTypes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CleaningRoutineRoomTypes_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CleaningRoutineDepartments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CleaningRoutineDepartments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "cleaning_routines_code_key" ON "cleaning_routines"("code");

-- CreateIndex
CREATE INDEX "cleaning_routines_type_idx" ON "cleaning_routines"("type");

-- CreateIndex
CREATE INDEX "cleaning_routines_isActive_idx" ON "cleaning_routines"("isActive");

-- CreateIndex
CREATE INDEX "_CleaningRoutineRoomTypes_B_index" ON "_CleaningRoutineRoomTypes"("B");

-- CreateIndex
CREATE INDEX "_CleaningRoutineDepartments_B_index" ON "_CleaningRoutineDepartments"("B");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "cleaning_routines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CleaningRoutineRoomTypes" ADD CONSTRAINT "_CleaningRoutineRoomTypes_A_fkey" FOREIGN KEY ("A") REFERENCES "cleaning_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CleaningRoutineRoomTypes" ADD CONSTRAINT "_CleaningRoutineRoomTypes_B_fkey" FOREIGN KEY ("B") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CleaningRoutineDepartments" ADD CONSTRAINT "_CleaningRoutineDepartments_A_fkey" FOREIGN KEY ("A") REFERENCES "cleaning_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CleaningRoutineDepartments" ADD CONSTRAINT "_CleaningRoutineDepartments_B_fkey" FOREIGN KEY ("B") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
