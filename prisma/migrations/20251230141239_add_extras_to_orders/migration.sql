-- CreateTable
CREATE TABLE "extras" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_extras" (
    "id" TEXT NOT NULL,
    "orderHeaderId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "extraId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_extras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extras_departmentId_idx" ON "extras"("departmentId");

-- CreateIndex
CREATE INDEX "extras_isActive_idx" ON "extras"("isActive");

-- CreateIndex
CREATE INDEX "order_extras_orderHeaderId_idx" ON "order_extras"("orderHeaderId");

-- CreateIndex
CREATE INDEX "order_extras_orderLineId_idx" ON "order_extras"("orderLineId");

-- CreateIndex
CREATE INDEX "order_extras_extraId_idx" ON "order_extras"("extraId");

-- CreateIndex
CREATE INDEX "order_extras_status_idx" ON "order_extras"("status");

-- AddForeignKey
ALTER TABLE "extras" ADD CONSTRAINT "extras_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_extras" ADD CONSTRAINT "order_extras_orderHeaderId_fkey" FOREIGN KEY ("orderHeaderId") REFERENCES "order_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_extras" ADD CONSTRAINT "order_extras_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_extras" ADD CONSTRAINT "order_extras_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "extras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
