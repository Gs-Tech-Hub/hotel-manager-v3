-- AlterTable
ALTER TABLE "order_headers" ADD COLUMN     "createdBy" TEXT;

-- CreateIndex
CREATE INDEX "order_headers_createdBy_idx" ON "order_headers"("createdBy");
