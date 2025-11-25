import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "@/lib/auth/credentials";
import { setAuthCookie } from "@/lib/auth/session";

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

    // Attempt login
    const result = await loginUser(email, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Login failed" },
        { status: 401 }
      );
    }

    // Return success with token
    const response = NextResponse.json(
      {
        success: true,
        message: "Login successful",
      },
      { status: 200 }
    );

    return response;
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
