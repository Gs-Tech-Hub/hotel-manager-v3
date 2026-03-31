import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/auth/middleware";
import { prisma } from "@/lib/auth/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { PermissionContext } from "@/lib/auth/rbac";

/**
 * Extract ID from URL path
 */
function extractIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/api\/roles\/([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * GET /api/roles/[id]
 * Get a specific role with permissions
 * Requires: roles.read permission
 */
async function getRole(req: NextRequest, context: PermissionContext) {
  try {
    const id = extractIdFromPath(req.nextUrl.pathname);

    if (!id) {
      return NextResponse.json(
        errorResponse("BAD_REQUEST", "Role ID is required"),
        { status: 400 }
      );
    }

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json(
        errorResponse("NOT_FOUND", "Role not found"),
        { status: 404 }
      );
    }

    return NextResponse.json(
      successResponse({
        data: {
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
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Get role error:", error);
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to get role"),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/roles/[id]
 * Update a role
 * Requires: roles.update permission
 */
async function updateRole(req: NextRequest, context: PermissionContext) {
  try {
    const id = extractIdFromPath(req.nextUrl.pathname);

    if (!id) {
      return NextResponse.json(
        errorResponse("BAD_REQUEST", "Role ID is required"),
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, description, isActive, permissionIds } = body;

    // Validate input
    if (!name) {
      return NextResponse.json(
        errorResponse("BAD_REQUEST", "Role name is required"),
        { status: 400 }
      );
    }

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json(
        errorResponse("NOT_FOUND", "Role not found"),
        { status: 404 }
      );
    }

    // Update role
    const role = await prisma.role.update({
      where: { id },
      data: {
        name,
        description,
        isActive: isActive !== undefined ? isActive : existingRole.isActive,
      },
    });

    // Update permissions if provided
    if (permissionIds && Array.isArray(permissionIds)) {
      // Remove old permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // Add new permissions
      if (permissionIds.length > 0) {
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
    }

    // Fetch updated role with permissions
    const updatedRole = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    console.log(`[API] Updated role: ${id}`);

    return NextResponse.json(
      successResponse({
        data: {
          id: updatedRole!.id,
          code: updatedRole!.code,
          name: updatedRole!.name,
          description: updatedRole!.description,
          type: updatedRole!.type,
          isActive: updatedRole!.isActive,
          permissions: updatedRole!.rolePermissions.map((rp) => ({
            id: rp.permission.id,
            action: rp.permission.action,
            subject: rp.permission.subject,
          })),
          createdAt: updatedRole!.createdAt,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Update role error:", error);
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to update role"),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roles/[id]
 * Delete a role (deactivate)
 * Requires: roles.delete permission
 */
async function deleteRole(req: NextRequest, context: PermissionContext) {
  try {
    const id = extractIdFromPath(req.nextUrl.pathname);

    if (!id) {
      return NextResponse.json(
        errorResponse("BAD_REQUEST", "Role ID is required"),
        { status: 400 }
      );
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      return NextResponse.json(
        errorResponse("NOT_FOUND", "Role not found"),
        { status: 404 }
      );
    }

    // Deactivate instead of deleting
    await prisma.role.update({
      where: { id },
      data: { isActive: false },
    });

    console.log(`[API] Deactivated role: ${id}`);

    return NextResponse.json(
      successResponse({
        message: "Role deactivated successfully",
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Delete role error:", error);
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to delete role"),
      { status: 500 }
    );
  }
}

// Route handlers with permission checks
export const GET = withPermission(
  getRole,
  "roles.read"
);

export const PUT = withPermission(
  updateRole,
  "roles.update"
);

export const DELETE = withPermission(
  deleteRole,
  "roles.delete"
);
