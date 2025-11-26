import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, getSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    
    if (session) {
      console.log(`[AUTH] User logout: ${session.userId} (${session.userType})`);
    }

    await clearAuthCookie();

    return NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
