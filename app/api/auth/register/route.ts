import { NextRequest, NextResponse } from "next/server";
import { registerEmployee } from "@/lib/auth/credentials";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, username, password, firstname, lastname } = body;

    // Validate required fields
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Email, username, and password are required" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Attempt registration
    const result = await registerEmployee(
      email,
      username,
      password,
      firstname,
      lastname
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Registration failed" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Registration successful. Please log in.",
        userId: result.userId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
