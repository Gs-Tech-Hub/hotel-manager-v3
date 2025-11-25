/**
 * Permission Caching Service
 * 
 * Redis-based caching for user permissions to reduce database load.
 * Includes cache invalidation on role/permission changes.
 * 
 * Usage:
 *   const perms = await getCachedUserPermissions(ctx);
 *   await invalidateUserPermissionsCache(userId);
 */

import { PermissionContext, getUserPermissions } from "./rbac";

// Redis client (initialize based on your setup)
let redis: any = null;

const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = "perms";

/**
 * Initialize Redis client for caching.
 * Call this in your app initialization.
 * 
 * @param redisClient Redis client instance
 */
export function initializeCache(redisClient: any) {
  redis = redisClient;
  console.log("[CACHE] Redis cache initialized for RBAC permissions");
}

/**
 * Generate cache key for a user's permissions.
 * 
 * @param ctx User context
 * @returns Cache key string
 */
function getCacheKey(ctx: PermissionContext): string {
  return `${CACHE_PREFIX}:${ctx.userId}:${ctx.userType}:${ctx.departmentId || "global"}`;
}

/**
 * Get cached user permissions, or fetch from DB if not cached.
 * 
 * @param ctx User context
 * @returns Array of permission strings
 */
export async function getCachedUserPermissions(
  ctx: PermissionContext
): Promise<string[]> {
  if (!redis) {
    // If Redis not available, fetch directly from DB
    return getUserPermissions(ctx);
  }

  try {
    const cacheKey = getCacheKey(ctx);

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[CACHE] Hit: ${cacheKey}`);
      return JSON.parse(cached);
    }

    // Cache miss: fetch from DB
    console.log(`[CACHE] Miss: ${cacheKey}`);
    const perms = await getUserPermissions(ctx);

    // Store in cache for next time
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(perms));
    console.log(`[CACHE] Stored: ${cacheKey} (TTL: ${CACHE_TTL}s)`);

    return perms;
  } catch (error) {
    console.error("[CACHE] Error fetching cached permissions:", error);
    // Fallback to DB on cache error
    return getUserPermissions(ctx);
  }
}

/**
 * Invalidate all cache entries for a specific user.
 * Call this when user roles/permissions are updated.
 * 
 * @param userId User ID to invalidate
 * @param userType Optional user type filter
 */
export async function invalidateUserPermissionsCache(
  userId: string,
  userType?: string
): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    if (userType) {
      // Invalidate specific user type
      const pattern = `${CACHE_PREFIX}:${userId}:${userType}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(
          `[CACHE] Invalidated ${keys.length} entries for ${userId} (${userType})`
        );
      }
    } else {
      // Invalidate all user entries
      const pattern = `${CACHE_PREFIX}:${userId}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`[CACHE] Invalidated ${keys.length} entries for ${userId}`);
      }
    }
  } catch (error) {
    console.error("[CACHE] Error invalidating cache:", error);
  }
}

/**
 * Invalidate cache for a specific department.
 * Call when department-scoped roles/permissions change.
 * 
 * @param departmentId Department ID
 */
export async function invalidateDepartmentCache(
  departmentId: string
): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    const pattern = `${CACHE_PREFIX}:*:*:${departmentId}`;
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(
        `[CACHE] Invalidated ${keys.length} entries for department ${departmentId}`
      );
    }
  } catch (error) {
    console.error("[CACHE] Error invalidating department cache:", error);
  }
}

/**
 * Clear all permission cache entries.
 * Useful for debugging or emergency cache reset.
 */
export async function clearAllPermissionCache(): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    const pattern = `${CACHE_PREFIX}:*`;
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[CACHE] Cleared all ${keys.length} permission cache entries`);
    }
  } catch (error) {
    console.error("[CACHE] Error clearing cache:", error);
  }
}

/**
 * Get cache statistics.
 * 
 * @returns Cache stats object
 */
export async function getCacheStats() {
  if (!redis) {
    return { enabled: false };
  }

  try {
    const pattern = `${CACHE_PREFIX}:*`;
    const keys = await redis.keys(pattern);

    return {
      enabled: true,
      totalEntries: keys.length,
      ttl: CACHE_TTL,
      prefix: CACHE_PREFIX,
    };
  } catch (error) {
    console.error("[CACHE] Error getting cache stats:", error);
    return { enabled: false, error: String(error) };
  }
}
