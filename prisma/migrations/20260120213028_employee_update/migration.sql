/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `employment_data` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "salary_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "grossSalary" DECIMAL(10,2) NOT NULL,
    "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_payments_userId_paymentDate_idx" ON "salary_payments"("userId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "employment_data_userId_key" ON "employment_data"("userId");

-- RenameIndex
ALTER INDEX "employee_leaves_start_end_idx" RENAME TO "employee_leaves_startDate_endDate_idx";
