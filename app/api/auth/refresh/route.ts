import { NextRequest, NextResponse } from "next/server";
import {
  getRefreshToken,
  verifyRefreshToken,
  createToken,
  setAuthCookie,
  buildSession,
} from "@/lib/auth/session";

/**
 * POST /api/auth/refresh
 * Refresh an expired access token using the refresh token
 */
export async function POST(req: NextRequest) {
  try {
    const refreshToken = await getRefreshToken();

    if (!refreshToken) {
      return NextResponse.json(
        { error: "No refresh token found" },
        { status: 401 }
      );
    }

    // Verify refresh token
    const decoded = await verifyRefreshToken(refreshToken);
    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    // Build new session
    // Try to determine userType from context or default to employee
    // In production, you might store userType in the refresh token or a separate lookup
    let session = await buildSession(decoded.userId, "employee");
    
    // If not found as employee, try admin
    if (!session) {
      session = await buildSession(decoded.userId, "admin");
    }

    if (!session) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    // Create new tokens
    const newAccessToken = await createToken(session);
    const newRefreshToken = await getRefreshToken();

    const response = NextResponse.json(
      {
        success: true,
        message: "Token refreshed successfully",
        user: {
          id: session.userId,
          email: session.email,
          firstName: session.firstName,
          lastName: session.lastName,
          userType: session.userType,
          roles: session.roles,
        },
      },
      { status: 200 }
    );

    // Set new tokens in cookies
    if (newRefreshToken) {
      await setAuthCookie(newAccessToken, newRefreshToken);
    }

    console.log(`[AUTH] Token refreshed for user: ${decoded.userId}`);

    return response;
  } catch (error) {
    console.error("[AUTH] Token refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 }
    );
  }
}
