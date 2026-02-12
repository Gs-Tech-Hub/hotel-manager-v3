/*
  Warnings:

  - Added the required column `sectionId` to the `game_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN     "sectionId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "game_sessions_sectionId_idx" ON "game_sessions"("sectionId");

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "department_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
