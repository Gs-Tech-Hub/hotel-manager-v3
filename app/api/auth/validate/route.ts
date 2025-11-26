import { NextRequest, NextResponse } from "next/server";
import { getSession, validateSession } from "@/lib/auth/session";

/**
 * GET /api/auth/validate
 * Validate the current session and return user permissions
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { valid: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Validate session
    const isValid = await validateSession(session);

    if (!isValid) {
      return NextResponse.json(
        { valid: false, error: "Session invalid or user inactive" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        session: {
          userId: session.userId,
          email: session.email,
          firstName: session.firstName,
          lastName: session.lastName,
          userType: session.userType,
          roles: session.roles,
          departmentId: session.departmentId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AUTH] Validation error:", error);
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 }
    );
  }
}
