-- CreateTable
CREATE TABLE "department_inventories" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_inventories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_inventories_departmentId_idx" ON "department_inventories"("departmentId");

-- CreateIndex
CREATE INDEX "department_inventories_inventoryItemId_idx" ON "department_inventories"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "department_inventories_departmentId_inventoryItemId_key" ON "department_inventories"("departmentId", "inventoryItemId");

-- AddForeignKey
ALTER TABLE "department_inventories" ADD CONSTRAINT "department_inventories_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_inventories" ADD CONSTRAINT "department_inventories_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
