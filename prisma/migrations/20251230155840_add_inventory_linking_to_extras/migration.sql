-- AlterTable
ALTER TABLE "extras" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "extras_productId_idx" ON "extras"("productId");

-- AddForeignKey
ALTER TABLE "extras" ADD CONSTRAINT "extras_productId_fkey" FOREIGN KEY ("productId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
