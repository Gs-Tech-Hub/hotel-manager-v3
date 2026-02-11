import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/auth/prisma";
import { extractUserContext } from "@/lib/user-context";
import { loadUserWithRoles } from "@/lib/user-context";
import {
  getDefaultRoleForDepartment,
  getAllDepartmentRoleMappings,
  setDefaultRoleForDepartment,
  resetDepartmentRoleMapping,
} from "@/lib/auth/department-role-mapping";
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from "@/lib/api-response";

/**
 * GET /api/admin/departments/role-mapping?departmentId={id}
 * Get all department-role mappings (with fallback to canonical)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !userWithRoles.isAdmin) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, "Only admins can view department role mappings"),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check if a specific departmentId is requested
    const departmentId = request.nextUrl.searchParams.get("departmentId");
    if (departmentId) {
      const role = await getDefaultRoleForDepartment(departmentId);
      return NextResponse.json(successResponse({ data: { departmentId, roleCode: role } }), { status: 200 });
    }

    // Otherwise, return all mappings
    const mappings = await getAllDepartmentRoleMappings();
    return NextResponse.json(successResponse({ data: { mappings } }), { status: 200 });
  } catch (error) {
    console.error("[API] Error fetching department role mappings:", error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch department role mappings"),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * POST /api/admin/departments/role-mapping
 * Set the default role for a department
 * 
 * Body: { departmentId: string, roleCode: string }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !userWithRoles.isAdmin) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, "Only admins can set department role mappings"),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const body = await request.json();
    const { departmentId, roleCode } = body;

    if (!departmentId || !roleCode) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, "departmentId and roleCode are required"),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }

    // Verify department exists
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!dept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, "Department not found"),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
    });

    if (!role) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, "Role not found"),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Set the mapping
    await setDefaultRoleForDepartment(departmentId, roleCode);

    return NextResponse.json(
      successResponse({
        data: {
          message: `Department "${dept.name}" now maps to role "${roleCode}"`,
          departmentId,
          roleCode,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Error setting department role mapping:", error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to set department role mapping"),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * DELETE /api/admin/departments/role-mapping?departmentId={id}
 * Reset a department's role mapping to its canonical value
 */
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !userWithRoles.isAdmin) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, "Only admins can reset department role mappings"),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const departmentId = request.nextUrl.searchParams.get("departmentId");
    if (!departmentId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, "departmentId is required"),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }

    // Verify department exists
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!dept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, "Department not found"),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Reset the mapping
    await resetDepartmentRoleMapping(departmentId);

    return NextResponse.json(
      successResponse({
        data: {
          message: `Department "${dept.name}" role mapping reset to canonical default`,
          departmentId,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Error resetting department role mapping:", error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to reset department role mapping"),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
