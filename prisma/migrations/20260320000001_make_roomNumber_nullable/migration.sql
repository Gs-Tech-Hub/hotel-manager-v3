-- AlterTable: Make roomNumber nullable to allow multiple deleted rooms with null values
ALTER TABLE "units" ALTER COLUMN "roomNumber" DROP NOT NULL;
