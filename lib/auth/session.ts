import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "hotel-manager-secret-key-change-in-production"
);

const COOKIE_NAME = "auth_token";
const TOKEN_EXPIRY = "7d";

export interface AuthSession {
  userId: string;
  userType: "admin" | "employee";
  email: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string;
}

/**
 * Create a JWT token for a user
 */
export async function createToken(session: AuthSession): Promise<string> {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);

  return token;
}

/**
 * Verify and parse JWT token
 */
export async function verifyToken(
  token: string
): Promise<AuthSession | null> {
  try {
    const verified = await jwtVerify(token, SECRET);
    return verified.payload as AuthSession;
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
 * Set auth cookie with token
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });
}

/**
 * Clear auth cookie on logout
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
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
