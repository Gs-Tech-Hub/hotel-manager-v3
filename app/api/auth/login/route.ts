import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "@/lib/auth/credentials";
import {
  setAuthCookie,
  createToken,
  createRefreshToken,
  buildSession,
} from "@/lib/auth/session";
import { prisma } from "@/lib/auth/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Attempt login (returns userId, userType, etc.)
    const result = await loginUser(email, password);

    if (!result.success) {
      console.warn(`[AUTH] Failed login attempt for: ${email}`);
      return NextResponse.json(
        { error: result.error || "Invalid email or password" },
        { status: 401 }
      );
    }

    // Build complete session with roles
    const session = await buildSession(result.userId!, result.userType!, result.departmentId || undefined);

    if (!session) {
      console.error(`[AUTH] Failed to build session for user: ${result.userId}`);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    // Create access and refresh tokens
    const accessToken = await createToken(session);
    const refreshToken = await createRefreshToken(result.userId!);

    // Set cookies
    const response = NextResponse.json(
      {
        success: true,
        message: "Login successful",
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

    // Set cookies in response
    await setAuthCookie(accessToken, refreshToken);

    console.log(`[AUTH] Successful login: ${email} (${result.userType})`);

    return response;
  } catch (error) {
    console.error("[AUTH] Login route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

