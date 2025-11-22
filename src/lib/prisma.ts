/**
 * Prisma Client Singleton
 * Ensures a single database connection throughout the application
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Attempt a lightweight connect in development to fail fast with a clear message.
// This surface clearer errors for common misconfigurations (for example,
// using the Prisma Data Proxy URL but having network/API key problems).
if (process.env.NODE_ENV === 'development') {
  // Don't await - start the connect and handle errors so the app can still boot
  // but we print a helpful message to the console for debugging.
  prisma
    .$connect()
    .then(() => {
      // If using the Prisma Data Proxy (DATABASE_URL begins with "prisma+")
      // print an informational message so the developer knows what is configured.
      try {
        const dbUrl = process.env.DATABASE_URL ?? '';
        if (dbUrl.startsWith('prisma+')) {
          console.info('Prisma: using Data Proxy (DATABASE_URL starts with prisma+).');
        }
      } catch (e) {
        /* ignore */
      }
    })
    .catch((err) => {
      // Provide a clearer, redacted error to help debugging without leaking secrets.
      const dbUrl = process.env.DATABASE_URL ?? '';
      const redactedDbUrl = dbUrl ? dbUrl.replace(/(api_key=)[^\s]+/, '$1[REDACTED]') : '[not set]';
      console.error('\nPrisma connection error (development).\nDATABASE_URL:', redactedDbUrl);
      console.error('If you are using the Prisma Data Proxy, ensure the URL and API key are valid and that your network allows outbound connections to the proxy.');
      console.error('Original error:', err);
    });
}

export default prisma;
