-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "orderHeaderId" TEXT;

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT,
    "type" TEXT DEFAULT 'general',
    "icon" TEXT,
    "image" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "departmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'percentage',
    "value" DECIMAL(10,2) NOT NULL,
    "maxUsagePerCustomer" INTEGER,
    "maxTotalUsage" INTEGER,
    "currentUsage" INTEGER NOT NULL DEFAULT 0,
    "minOrderAmount" INTEGER,
    "applicableDepts" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_headers" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "departmentCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "orderHeaderId" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "unitDiscount" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_departments" (
    "id" TEXT NOT NULL,
    "orderHeaderId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "departmentNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_discounts" (
    "id" TEXT NOT NULL,
    "orderHeaderId" TEXT NOT NULL,
    "discountRuleId" TEXT,
    "discountType" TEXT NOT NULL,
    "discountCode" TEXT,
    "description" TEXT,
    "discountAmount" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_payments" (
    "id" TEXT NOT NULL,
    "orderHeaderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "transactionReference" TEXT,
    "paymentTypeId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_fulfillments" (
    "id" TEXT NOT NULL,
    "orderHeaderId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "status" TEXT NOT NULL,
    "fulfilledQuantity" INTEGER NOT NULL DEFAULT 0,
    "fulfilledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "orderHeaderId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_slug_key" ON "departments"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "terminals_slug_key" ON "terminals"("slug");

-- CreateIndex
CREATE INDEX "terminals_slug_idx" ON "terminals"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "discount_rules_code_key" ON "discount_rules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "order_headers_orderNumber_key" ON "order_headers"("orderNumber");

-- CreateIndex
CREATE INDEX "order_headers_customerId_idx" ON "order_headers"("customerId");

-- CreateIndex
CREATE INDEX "order_headers_status_idx" ON "order_headers"("status");

-- CreateIndex
CREATE INDEX "order_headers_createdAt_idx" ON "order_headers"("createdAt");

-- CreateIndex
CREATE INDEX "order_lines_orderHeaderId_idx" ON "order_lines"("orderHeaderId");

-- CreateIndex
CREATE INDEX "order_lines_departmentCode_idx" ON "order_lines"("departmentCode");

-- CreateIndex
CREATE INDEX "order_departments_departmentId_idx" ON "order_departments"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "order_departments_orderHeaderId_departmentId_key" ON "order_departments"("orderHeaderId", "departmentId");

-- CreateIndex
CREATE INDEX "order_discounts_orderHeaderId_idx" ON "order_discounts"("orderHeaderId");

-- CreateIndex
CREATE INDEX "order_payments_orderHeaderId_idx" ON "order_payments"("orderHeaderId");

-- CreateIndex
CREATE INDEX "order_payments_paymentStatus_idx" ON "order_payments"("paymentStatus");

-- CreateIndex
CREATE INDEX "order_fulfillments_orderHeaderId_idx" ON "order_fulfillments"("orderHeaderId");

-- CreateIndex
CREATE INDEX "order_fulfillments_status_idx" ON "order_fulfillments"("status");

-- CreateIndex
CREATE INDEX "inventory_reservations_inventoryItemId_idx" ON "inventory_reservations"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_reservations_orderHeaderId_idx" ON "inventory_reservations"("orderHeaderId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_orderHeaderId_fkey" FOREIGN KEY ("orderHeaderId") REFERENCES "order_headers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_headers" ADD CONSTRAINT "order_headers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_orderHeaderId_fkey" FOREIGN KEY ("orderHeaderId") REFERENCES "order_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_departments" ADD CONSTRAINT "order_departments_orderHeaderId_fkey" FOREIGN KEY ("orderHeaderId") REFERENCES "order_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_departments" ADD CONSTRAINT "order_departments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_orderHeaderId_fkey" FOREIGN KEY ("orderHeaderId") REFERENCES "order_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_discountRuleId_fkey" FOREIGN KEY ("discountRuleId") REFERENCES "discount_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_orderHeaderId_fkey" FOREIGN KEY ("orderHeaderId") REFERENCES "order_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "payment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_fulfillments" ADD CONSTRAINT "order_fulfillments_orderHeaderId_fkey" FOREIGN KEY ("orderHeaderId") REFERENCES "order_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_fulfillments" ADD CONSTRAINT "order_fulfillments_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_orderHeaderId_fkey" FOREIGN KEY ("orderHeaderId") REFERENCES "order_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
