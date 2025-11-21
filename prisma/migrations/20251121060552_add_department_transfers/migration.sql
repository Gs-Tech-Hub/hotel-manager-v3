-- CreateTable
CREATE TABLE "department_transfers" (
    "id" TEXT NOT NULL,
    "fromDepartmentId" TEXT NOT NULL,
    "toDepartmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_transfer_items" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_transfers_fromDepartmentId_idx" ON "department_transfers"("fromDepartmentId");

-- CreateIndex
CREATE INDEX "department_transfers_toDepartmentId_idx" ON "department_transfers"("toDepartmentId");

-- CreateIndex
CREATE INDEX "department_transfer_items_transferId_idx" ON "department_transfer_items"("transferId");

-- AddForeignKey
ALTER TABLE "department_transfers" ADD CONSTRAINT "department_transfers_fromDepartmentId_fkey" FOREIGN KEY ("fromDepartmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_transfers" ADD CONSTRAINT "department_transfers_toDepartmentId_fkey" FOREIGN KEY ("toDepartmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_transfer_items" ADD CONSTRAINT "department_transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "department_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
