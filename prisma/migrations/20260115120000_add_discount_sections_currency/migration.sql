-- AlterTable
ALTER TABLE "discount_rules" ADD COLUMN "applicableSections" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
