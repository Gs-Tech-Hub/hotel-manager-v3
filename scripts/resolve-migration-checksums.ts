/**
 * Resolve migration checksums - align _prisma_migrations with current migration files
 *
 * Use when migrations were modified after being applied (e.g. made resilient with IF EXISTS).
 * This updates the stored checksum to match the current file content so Prisma stops
 * reporting "migration was modified after it was applied".
 *
 * If using Prisma Accelerate, ensure DATABASE_URL points to a direct PostgreSQL
 * connection for this script (or use DIRECT_DATABASE_URL if defined in schema).
 *
 * Usage: npx tsx scripts/resolve-migration-checksums.ts
 */

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

const MIGRATIONS_TO_RESOLVE = [
  "20260303114811_refactor_terminal_section_scoped",
  "add_terminal_support",
];

function computeChecksum(migrationName: string): string {
  const sqlPath = join(MIGRATIONS_DIR, migrationName, "migration.sql");
  const content = readFileSync(sqlPath, "utf-8");
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function main() {
  const prisma = new PrismaClient();

  try {
    for (const migrationName of MIGRATIONS_TO_RESOLVE) {
      const checksum = computeChecksum(migrationName);
      const result = await prisma.$executeRawUnsafe(
        `UPDATE "_prisma_migrations" SET checksum = $1 WHERE migration_name = $2`,
        checksum,
        migrationName
      );
      console.log(
        `Updated checksum for "${migrationName}": ${(result as number) > 0 ? "OK" : "no rows (migration not in history)"}`
      );
    }
    console.log("\nDone. Run `npx prisma migrate status` to verify.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
