-- AlterTable
ALTER TABLE "salary_payments" ADD COLUMN "salaryDueDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "salary_payments_salaryDueDate_idx" ON "salary_payments"("salaryDueDate");
