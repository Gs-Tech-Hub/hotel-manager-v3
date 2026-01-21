-- Migration: add employment tables
-- Creates: employment_data, employee_leaves, employee_charges, employee_terminations

-- CreateTable
CREATE TABLE "employment_data" (
    "id" TEXT NOT NULL,
    "employmentDate" TIMESTAMP(3) NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "salary" NUMERIC(10,2) NOT NULL,
    "salaryType" TEXT NOT NULL DEFAULT 'monthly',
    "salaryFrequency" TEXT NOT NULL DEFAULT 'monthly',
    "employmentStatus" TEXT NOT NULL DEFAULT 'active',
    "contractType" TEXT,
    "reportsTo" TEXT,
    "terminationDate" TIMESTAMP(3),
    "terminationReason" TEXT,
    "terminationNotes" TEXT,
    "totalDebts" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "totalCharges" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employment_data_employmentStatus_idx" ON "employment_data"("employmentStatus");

-- CreateIndex
CREATE INDEX "employment_data_department_employmentStatus_idx" ON "employment_data"("department", "employmentStatus");

-- CreateTable
CREATE TABLE "employee_leaves" (
    "id" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "numberOfDays" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "notes" TEXT,
    "employmentDataId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_leaves_employmentDataId_status_idx" ON "employee_leaves"("employmentDataId", "status");

-- CreateIndex
CREATE INDEX "employee_leaves_start_end_idx" ON "employee_leaves"("startDate", "endDate");

-- CreateTable
CREATE TABLE "employee_charges" (
    "id" TEXT NOT NULL,
    "chargeType" TEXT NOT NULL,
    "amount" NUMERIC(10,2) NOT NULL,
    "description" TEXT,
    "reason" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
    "paymentDate" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "notes" TEXT,
    "employmentDataId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_charges_employmentDataId_status_idx" ON "employee_charges"("employmentDataId", "status");

-- CreateIndex
CREATE INDEX "employee_charges_date_idx" ON "employee_charges"("date");

-- CreateTable
CREATE TABLE "employee_terminations" (
    "id" TEXT NOT NULL,
    "terminationDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "finalSettlement" NUMERIC(10,2) NOT NULL,
    "settlementStatus" TEXT NOT NULL DEFAULT 'pending',
    "settlementDate" TIMESTAMP(3),
    "notes" TEXT,
    "employmentDataId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_terminations_pkey" PRIMARY KEY ("id")
);

-- AddUnique
ALTER TABLE "employee_terminations" ADD CONSTRAINT "employee_terminations_employmentDataId_key" UNIQUE ("employmentDataId");

-- AddForeignKey
ALTER TABLE "employment_data" ADD CONSTRAINT "employment_data_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users_permissions_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leaves" ADD CONSTRAINT "employee_leaves_employmentDataId_fkey" FOREIGN KEY ("employmentDataId") REFERENCES "employment_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_charges" ADD CONSTRAINT "employee_charges_employmentDataId_fkey" FOREIGN KEY ("employmentDataId") REFERENCES "employment_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_terminations" ADD CONSTRAINT "employee_terminations_employmentDataId_fkey" FOREIGN KEY ("employmentDataId") REFERENCES "employment_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;
