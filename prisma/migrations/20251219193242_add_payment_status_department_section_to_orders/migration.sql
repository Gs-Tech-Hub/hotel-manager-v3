-- AlterTable
ALTER TABLE "order_headers" ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid';

-- AlterTable
ALTER TABLE "order_lines" ADD COLUMN     "departmentSectionId" TEXT;

-- CreateIndex
CREATE INDEX "order_headers_paymentStatus_idx" ON "order_headers"("paymentStatus");

-- CreateIndex
CREATE INDEX "order_lines_departmentSectionId_idx" ON "order_lines"("departmentSectionId");

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_departmentSectionId_fkey" FOREIGN KEY ("departmentSectionId") REFERENCES "department_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
