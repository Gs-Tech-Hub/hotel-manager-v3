import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Attempt a lightweight connect in development to fail fast with a clear message
if (process.env.NODE_ENV === "development") {
  prisma
    .$connect()
    .then(() => {
      try {
        const dbUrl = process.env.DATABASE_URL ?? "";
        if (dbUrl.startsWith("prisma+")) {
          console.info("[AUTH] Using Prisma Data Proxy (DATABASE_URL starts with prisma+)");
        } else {
          console.info("[AUTH] Using direct database connection");
        }
      } catch (e) {
        /* ignore */
      }
    })
    .catch((err) => {
      const dbUrl = process.env.DATABASE_URL ?? "";
      const redactedDbUrl = dbUrl ? dbUrl.replace(/(api_key=)[^\s]+/, "$1[REDACTED]") : "[not set]";
      console.error(
        "\n[AUTH] Prisma connection error (development).\nDATABASE_URL:",
        redactedDbUrl
      );
      console.error(
        "If you are using the Prisma Data Proxy, ensure the URL and API key are valid."
      );
      console.error("If using direct connection, ensure the database is running and accessible.");
      console.error("Original error:", err);
    });
}

