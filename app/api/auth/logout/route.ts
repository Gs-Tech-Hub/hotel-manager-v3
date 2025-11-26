import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

const COOKIE_NAME = "auth_token";
const REFRESH_COOKIE_NAME = "refresh_token";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (session) {
      console.log(`[AUTH] User logout: ${session.userId} (${session.userType})`);
    }

    // Create response and explicitly expire cookies to ensure browser clears them
    const res = NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 }
    );

    // Set cookies with maxAge 0 to instruct clients to remove them
    res.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    res.cookies.set(REFRESH_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
