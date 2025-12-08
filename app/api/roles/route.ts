import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/middleware";
import { prisma } from "@/lib/auth/prisma";

/**
 * GET /api/roles
 * List all roles with their permissions
 * Requires: roles.read permission
 */
async function listRoles(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // admin, employee, or all
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const skip = (page - 1) * limit;

    const where = type && type !== "all" ? { type } : {};

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        skip,
        take: limit,
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      }),
      prisma.role.count({ where }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: roles.map((role) => ({
          id: role.id,
          code: role.code,
          name: role.name,
          description: role.description,
          type: role.type,
          isActive: role.isActive,
          permissions: role.rolePermissions.map((rp) => ({
            id: rp.permission.id,
            action: rp.permission.action,
            subject: rp.permission.subject,
          })),
          createdAt: role.createdAt,
        })),
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
    console.error("[API] List roles error:", error);
    return NextResponse.json(
      { error: "Failed to list roles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roles
 * Create a new role
 * Requires: roles.create permission
 */
async function createRole(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, name, description, type, permissionIds } = body;

    // Validate input
    if (!code || !name || !type) {
      return NextResponse.json(
        { error: "Missing required fields: code, name, type" },
        { status: 400 }
      );
    }

    // Check if role exists
    const existing = await prisma.role.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Role with this code already exists" },
        { status: 409 }
      );
    }

    // Create role
    const role = await prisma.role.create({
      data: {
        code,
        name,
        description,
        type,
        isActive: true,
      },
    });

    // Assign permissions if provided
    if (permissionIds && Array.isArray(permissionIds)) {
      await Promise.all(
        permissionIds.map((permId) =>
          prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permId,
            },
          })
        )
      );
    }

    console.log(`[API] Created role: ${code} (ID: ${role.id})`);

    return NextResponse.json(
      {
        success: true,
        data: role,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Create role error:", error);
    return NextResponse.json(
      { error: "Failed to create role" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/roles/[id]
 * Update a role
 * Requires: roles.update permission
 */
async function updateRole(req: NextRequest, id: string) {
  try {
    const body = await req.json();
    const { name, description, isActive, permissionIds } = body;

    const role = await prisma.role.update({
      where: { id },
      data: {
        name,
        description,
        isActive,
      },
    });

    // Update permissions if provided
    if (permissionIds && Array.isArray(permissionIds)) {
      // Remove old permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // Add new permissions
      await Promise.all(
        permissionIds.map((permId) =>
          prisma.rolePermission.create({
            data: {
              roleId: id,
              permissionId: permId,
            },
          })
        )
      );
    }

    console.log(`[API] Updated role: ${id}`);

    return NextResponse.json(
      {
        success: true,
        data: role,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Update role error:", error);
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roles/[id]
 * Delete a role (deactivate)
 * Requires: roles.delete permission
 */
async function deleteRole(req: NextRequest, id: string) {
  try {
    // Deactivate instead of deleting
    await prisma.role.update({
      where: { id },
      data: { isActive: false },
    });

    console.log(`[API] Deactivated role: ${id}`);

    return NextResponse.json(
      {
        success: true,
        message: "Role deactivated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Delete role error:", error);
    return NextResponse.json(
      { error: "Failed to delete role" },
      { status: 500 }
    );
  }
}

// Route handlers with permission checks
export const GET = withPermission(
  listRoles,
  "roles.read"
);

export const POST = withPermission(
  createRole,
  "roles.create"
);

export const PUT = withPermission(
  async (req, ctx) => {
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    return updateRole(req, id!);
  },
  "roles.update"
);

export const DELETE = withPermission(
  async (req, ctx) => {
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    return deleteRole(req, id!);
  },
  "roles.delete"
);
