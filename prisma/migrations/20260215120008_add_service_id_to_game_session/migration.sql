-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN     "serviceId" TEXT;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
