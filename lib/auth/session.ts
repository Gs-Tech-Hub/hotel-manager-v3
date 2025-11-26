import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "hotel-manager-secret-key-change-in-production"
);
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.REFRESH_SECRET || "hotel-manager-refresh-key-change-in-production"
);

const COOKIE_NAME = "auth_token";
const REFRESH_COOKIE_NAME = "refresh_token";
const TOKEN_EXPIRY = "1h"; // Access token valid for 1 hour
const REFRESH_EXPIRY = "7d"; // Refresh token valid for 7 days

export interface AuthSession {
  userId: string;
  userType: "admin" | "employee";
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: string[]; // Assigned roles
  departmentId?: string;
  permissions?: string[]; // Cached permissions
  iat?: number; // Issued at
  exp?: number; // Expiration
}

/**
 * Create a JWT access token for a user with role information
 */
export async function createToken(session: AuthSession): Promise<string> {
  const payload = {
    ...session,
    iat: Math.floor(Date.now() / 1000),
  } as unknown as Record<string, unknown>;
  
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(SECRET);

  return token;
}

/**
 * Create a JWT refresh token for session renewal
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const payload = {
    userId,
    type: "refresh",
  } as unknown as Record<string, unknown>;
  
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(REFRESH_EXPIRY)
    .sign(REFRESH_SECRET);

  return token;
}

/**
 * Verify and parse JWT access token
 */
export async function verifyToken(
  token: string
): Promise<AuthSession | null> {
  try {
    const verified = await jwtVerify(token, SECRET);
    return verified.payload as unknown as AuthSession;
  } catch {
    return null;
  }
}

/**
 * Verify and parse JWT refresh token
 */
export async function verifyRefreshToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const verified = await jwtVerify(token, REFRESH_SECRET);
    return {
      userId: verified.payload.userId as string,
    };
  } catch {
    return null;
  }
}

/**
 * Get current session from cookies
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    return await verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Set auth cookies with access and refresh tokens
 */
export async function setAuthCookie(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();
  
  // Access token cookie (short-lived, httpOnly)
  cookieStore.set(COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  });
  
  // Refresh token cookie (long-lived, httpOnly)
  cookieStore.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });
}

/**
 * Clear auth cookies on logout
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
}

/**
 * Get refresh token from cookies
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(REFRESH_COOKIE_NAME)?.value || null;
  } catch {
    return null;
  }
}

/**
 * Extract user context from request headers (for API routes)
 */
export function extractUserFromHeaders(headers: Headers): Partial<AuthSession> {
  return {
    userId: headers.get("x-user-id") || undefined,
    userType: (headers.get("x-user-type") as "admin" | "employee") || undefined,
    email: headers.get("x-user-email") || undefined,
    departmentId: headers.get("x-department-id") || undefined,
  };
}

/**
 * Extract and verify JWT from Authorization header (for API tokens)
 */
export async function verifyAuthHeader(
  authHeader: string | null
): Promise<AuthSession | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  return verifyToken(token);
}

/**
 * Validate session and check if it's still active
 * Validates both token integrity and user existence in database
 */
export async function validateSession(session: AuthSession): Promise<boolean> {
  if (!session.userId || !session.userType) {
    return false;
  }

  try {
    // Check if user still exists and is active
    if (session.userType === "admin") {
      const admin = await prisma.adminUser.findUnique({
        where: { id: session.userId },
      });
      return admin?.isActive === true;
    } else if (session.userType === "employee") {
      const employee = await prisma.pluginUsersPermissionsUser.findUnique({
        where: { id: session.userId },
      });
      return employee?.blocked === false;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Build a complete session with roles and permissions
 */
export async function buildSession(
  userId: string,
  userType: "admin" | "employee",
  departmentId?: string
): Promise<AuthSession | null> {
  try {
    let user: any = null;
    let email = "";
    let firstName = "";
    let lastName = "";

    // Fetch user details
    if (userType === "admin") {
      user = await prisma.adminUser.findUnique({
        where: { id: userId },
      });
      email = user?.email || "";
      firstName = user?.firstname || "";
      lastName = user?.lastname || "";
    } else {
      user = await prisma.pluginUsersPermissionsUser.findUnique({
        where: { id: userId },
      });
      email = user?.email || "";
      firstName = user?.firstname || "";
      lastName = user?.lastname || "";
    }

    if (!user) return null;

    // Fetch user roles
      // Check whether unified user_roles table exists. If not, fall back to
      // legacy relations (e.g., adminUser.roles) to avoid Prisma P2021 errors.
      try {
        const hasUserRolesRow: any[] = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'user_roles'
          ) as exists`;
        const hasUserRoles = Array.isArray(hasUserRolesRow) && (hasUserRolesRow[0]?.exists || false);

        let rolesList: string[] = [];

        if (hasUserRoles) {
          const userRoles = await prisma.userRole.findMany({
            where: {
              userId,
              userType,
              ...(departmentId ? { departmentId } : {}),
            },
            include: {
              role: true,
            },
          });

          rolesList = userRoles.map((ur) => ur.role.code);
        } else if (userType === "admin") {
          // Fallback for legacy schema: admin users fetch from AdminRole relation
          try {
            const adminWithRoles = await prisma.adminUser.findUnique({
              where: { id: userId },
              include: { roles: true },
            });

            rolesList = (adminWithRoles?.roles || []).map((r: any) => r.code);
          } catch (err) {
            console.warn("[AUTH] Legacy admin roles fetch failed:", err);
            rolesList = [];
          }
        }

        return {
          userId,
          userType,
          email,
          firstName,
          lastName,
          departmentId,
          roles: rolesList,
        };
      } catch (err) {
        console.error("Error fetching user roles (schema detection):", err);
        return {
          userId,
          userType,
          email,
          firstName,
          lastName,
          departmentId,
          roles: [],
        };
      }
  } catch (error) {
    console.error("Error building session:", error);
    return null;
  }
}
