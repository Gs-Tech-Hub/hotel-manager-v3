import { NextRequest, NextResponse } from "next/server";
import { getSession, validateSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Validate that user still exists and is active
    const isValid = await validateSession(session);
    if (!isValid) {
      return NextResponse.json(
        { error: "Session invalid or user inactive" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
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
    console.error("[AUTH] Session retrieval error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve session" },
      { status: 500 }
    );
  }
}

