import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/middleware";
import { prisma } from "@/lib/auth/prisma";

/**
 * POST /api/admin/roles/assign
 * Assign a role to a user
 */
async function assignRole(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, userType, roleId, departmentId } = body;

    // Validate input
    if (!userId || !userType || !roleId) {
      return NextResponse.json(
        { error: "Missing required fields: userId, userType, roleId" },
        { status: 400 }
      );
    }

    // Check if user exists
    let user;
    if (userType === "admin") {
      user = await prisma.adminUser.findUnique({ where: { id: userId } });
    } else {
      user = await prisma.pluginUsersPermissionsUser.findUnique({
        where: { id: userId },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if role exists
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    // Check if assignment already exists
    const existing = await prisma.userRole.findFirst({
      where: {
        userId,
        userType,
        roleId,
        departmentId: departmentId || null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "User already has this role" },
        { status: 409 }
      );
    }

    // Create assignment
    const userRole = await prisma.userRole.create({
      data: {
        userId,
        userType,
        roleId,
        departmentId,
        grantedAt: new Date(),
        grantedBy: "system",
      },
      include: {
        role: true,
      },
    });

    console.log(
      `[ADMIN] Assigned role ${role.code} to ${userType} ${userId}`
    );

    return NextResponse.json(
      {
        success: true,
        data: userRole,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ADMIN] Assign role error:", error);
    return NextResponse.json(
      { error: "Failed to assign role" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/roles/assign/[userId]/[roleId]
 * Revoke a role from a user
 */
async function revokeRole(req: NextRequest, userId: string, roleId: string) {
  try {
    const body = await req.json();
    const { userType, departmentId } = body;

    if (!userType) {
      return NextResponse.json(
        { error: "Missing userType" },
        { status: 400 }
      );
    }

    // Find and delete the assignment
    const deleted = await prisma.userRole.deleteMany({
      where: {
        userId,
        userType,
        roleId,
        departmentId: departmentId || null,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Role assignment not found" },
        { status: 404 }
      );
    }

    console.log(`[ADMIN] Revoked role from ${userType} ${userId}`);

    return NextResponse.json(
      {
        success: true,
        message: "Role revoked successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ADMIN] Revoke role error:", error);
    return NextResponse.json(
      { error: "Failed to revoke role" },
      { status: 500 }
    );
  }
}

// Route handlers
export const POST = withPermission(
  assignRole,
  "roles.update"
);

export const DELETE = withPermission(
  async (req, ctx) => {
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const userId = segments[segments.length - 2];
    const roleId = segments[segments.length - 1];
    return revokeRole(req, userId, roleId);
  },
  "roles.update"
);
