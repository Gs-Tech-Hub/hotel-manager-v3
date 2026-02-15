-- AlterTable
ALTER TABLE "department_sections" ADD COLUMN     "pricePerGame" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pricePerHour" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pricingModel" TEXT NOT NULL DEFAULT 'per_game';
