import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        session,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Session retrieval error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve session" },
      { status: 500 }
    );
  }
}
