-- AlterTable
ALTER TABLE "discount_rules" ALTER COLUMN "value" SET DATA TYPE DECIMAL(15,2);

-- CreateTable
CREATE TABLE "game_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricePerGame" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "gameTypeId" TEXT NOT NULL,
    "gameCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "orderId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_types_departmentId_idx" ON "game_types"("departmentId");

-- CreateIndex
CREATE INDEX "game_types_isActive_idx" ON "game_types"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "game_types_departmentId_name_key" ON "game_types"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_orderId_key" ON "game_sessions"("orderId");

-- CreateIndex
CREATE INDEX "game_sessions_customerId_idx" ON "game_sessions"("customerId");

-- CreateIndex
CREATE INDEX "game_sessions_status_idx" ON "game_sessions"("status");

-- CreateIndex
CREATE INDEX "game_sessions_startedAt_idx" ON "game_sessions"("startedAt");

-- AddForeignKey
ALTER TABLE "game_types" ADD CONSTRAINT "game_types_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_gameTypeId_fkey" FOREIGN KEY ("gameTypeId") REFERENCES "game_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
