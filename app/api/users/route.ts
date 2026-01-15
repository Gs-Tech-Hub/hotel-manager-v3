import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/middleware";
import { prisma } from "@/lib/auth/prisma";
import { hashPassword } from "@/lib/auth/credentials";

// Type definitions
type AdminUserType = {
  id: string;
  email: string;
  username: string | null;
  password: string;
  firstname: string | null;
  lastname: string | null;
  isActive?: boolean;
  blocked?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  [key: string]: any;
};

type EmployeeUserType = {
  id: string;
  email: string;
  username: string | null;
  password: string;
  firstname: string | null;
  lastname: string | null;
  blocked: boolean;
  isActive?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  [key: string]: any;
};

/**
 * GET /api/users
 * List all users (admin, employee) with pagination
 * Requires: users.read permission
 */
async function listUsers(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const userType = url.searchParams.get("userType"); // admin or employee

    const skip = (page - 1) * limit;

    let users: Array<{
      id: string;
      email: string;
      username: string | null;
      firstname?: string | null;
      lastname?: string | null;
      isActive?: boolean;
      blocked?: boolean;
      createdAt: Date;
      userType: "admin" | "employee";
    }> = [];
    let total = 0;

    if (userType === "admin" || !userType) {
      const [adminUsers, adminCount] = await Promise.all([
        prisma.adminUser.findMany({
          skip,
          take: limit,
          select: {
            id: true,
            email: true,
            username: true,
            firstname: true,
            lastname: true,
            isActive: true,
            blocked: false,
            createdAt: true,
          },
        }),
        prisma.adminUser.count(),
      ]);

      users = adminUsers.map((u) => ({
        ...u,
        blocked: false,
        userType: "admin" as const,
      }));
      total = adminCount;
    }

    if (userType === "employee" || !userType) {
      const [empUsers, empCount] = await Promise.all([
        prisma.pluginUsersPermissionsUser.findMany({
          skip,
          take: limit,
          select: {
            id: true,
            email: true,
            username: true,
            firstname: true,
            lastname: true,
            blocked: true,
            createdAt: true,
          },
        }),
        prisma.pluginUsersPermissionsUser.count(),
      ]);

      users = [
        ...users,
        ...empUsers.map((u) => ({
          ...u,
          isActive: !u.blocked,
          userType: "employee" as const,
        })),
      ];
      total += empCount;
    }

    return NextResponse.json(
      {
        success: true,
        data: users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] List users error:", error);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Create a new user
 * Requires: users.create permission
 */
async function createUser(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      userType,
      roleId,
      departmentId,
    } = body;

    // Validate input
    if (!email || !password || !userType) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, userType" },
        { status: 400 }
      );
    }

    if (userType !== "admin" && userType !== "employee") {
      return NextResponse.json(
        { error: "Invalid userType. Must be 'admin' or 'employee'" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    let user: AdminUserType | EmployeeUserType | null = null;

    if (userType === "admin") {
      // Check if admin already exists
      const existing = await prisma.adminUser.findUnique({
        where: { email },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Admin user with this email already exists" },
          { status: 409 }
        );
      }

      user = await prisma.adminUser.create({
        data: {
          email,
          username: username || email.split("@")[0],
          password: hashedPassword,
          firstname: firstName,
          lastname: lastName,
          isActive: true,
        },
      });
    } else {
      // Create employee
      const existing = await prisma.pluginUsersPermissionsUser.findUnique({
        where: { email },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Employee with this email already exists" },
          { status: 409 }
        );
      }

      user = await prisma.pluginUsersPermissionsUser.create({
        data: {
          email,
          username: username || email.split("@")[0],
          password: hashedPassword,
          firstname: firstName,
          lastname: lastName,
          blocked: false,
        },
      });
    }

    // Assign role if provided
    if (roleId && user) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          userType,
          roleId,
          departmentId,
          grantedAt: new Date(),
          grantedBy: "system",
        },
      });
    }

    console.log(
      `[API] Created ${userType} user: ${email} (ID: ${user.id})`
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          userType,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Create user error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/[id]
 * Update a user
 * Requires: users.update permission
 */
async function updateUser(req: NextRequest, id: string) {
  try {
    const body = await req.json();
    const { firstName, lastName, isActive, blocked, userType } = body;

    if (!userType || !id) {
      return NextResponse.json(
        { error: "Missing userType or id" },
        { status: 400 }
      );
    }

    type UpdateResult = AdminUserType | EmployeeUserType | null;
    let user: UpdateResult = null;

    if (userType === "admin") {
      user = await prisma.adminUser.update({
        where: { id },
        data: {
          firstname: firstName,
          lastname: lastName,
          isActive: isActive !== undefined ? isActive : undefined,
        },
      });
    } else if (userType === "employee") {
      user = await prisma.pluginUsersPermissionsUser.update({
        where: { id },
        data: {
          firstname: firstName,
          lastname: lastName,
          blocked: blocked !== undefined ? blocked : undefined,
        },
      });
    }

    console.log(`[API] Updated ${userType} user: ${id}`);

    return NextResponse.json(
      {
        success: true,
        data: user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id]
 * Deactivate/block a user (soft delete)
 * Requires: users.delete permission
 */
async function deleteUser(req: NextRequest, id: string) {
  try {
    const body = await req.json();
    const { userType } = body;

    if (!userType || !id) {
      return NextResponse.json(
        { error: "Missing userType or id" },
        { status: 400 }
      );
    }

    if (userType === "admin") {
      await prisma.adminUser.update({
        where: { id },
        data: { isActive: false },
      });
    } else if (userType === "employee") {
      await prisma.pluginUsersPermissionsUser.update({
        where: { id },
        data: { blocked: true },
      });
    }

    console.log(`[API] Deactivated ${userType} user: ${id}`);

    return NextResponse.json(
      {
        success: true,
        message: "User deactivated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Delete user error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}

// Route handlers with permission checks
export const GET = withPermission(
  listUsers,
  "users.read"
);

export const POST = withPermission(
  createUser,
  "users.create"
);

export const PUT = withPermission(
  async (req: NextRequest, ctx) => {
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    return updateUser(req, id!);
  },
  "users.update"
);

export const DELETE = withPermission(
  async (req: NextRequest, ctx) => {
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    return deleteUser(req, id!);
  },
  "users.delete"
);

