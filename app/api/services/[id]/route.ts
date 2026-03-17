import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/auth/prisma";
import { extractUserContext, loadUserWithRoles, hasAnyRole } from "@/lib/user-context";
import { successResponse, errorResponse, ErrorCodes } from "@/lib/api-response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED), { status: 401 });
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ["admin", "manager"])) {
      return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, "Insufficient permissions"), { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.serviceInventory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, "Service not found"), { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(errorResponse(ErrorCodes.BAD_REQUEST, "Invalid JSON body"), { status: 400 });
    }

    const {
      name,
      serviceType,
      pricingModel,
      pricePerCount,
      pricePerMinute,
      description,
      isActive,
    } = body as Record<string, any>;

    // If name changes, enforce uniqueness within the same scope (dept+section)
    if (typeof name === "string" && name.trim() && name.trim() !== existing.name) {
      const dup = await prisma.serviceInventory.findFirst({
        where: {
          id: { not: id },
          name: name.trim(),
          departmentId: existing.departmentId,
          sectionId: existing.sectionId,
          isActive: true,
        },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json(
          errorResponse(ErrorCodes.CONFLICT, "Service with this name already exists in this scope"),
          { status: 409 }
        );
      }
    }

    // Pricing validation (if updating)
    if (pricingModel && !["per_count", "per_time"].includes(pricingModel)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'pricingModel must be "per_count" or "per_time"'),
        { status: 400 }
      );
    }

    const nextPricingModel = (pricingModel ?? existing.pricingModel) as string;
    const nextPricePerCount = pricePerCount ?? existing.pricePerCount;
    const nextPricePerMinute = pricePerMinute ?? existing.pricePerMinute;

    if (nextPricingModel === "per_count") {
      if (nextPricePerCount === null || nextPricePerCount === undefined || Number(nextPricePerCount) <= 0) {
        return NextResponse.json(
          errorResponse(ErrorCodes.BAD_REQUEST, "pricePerCount required and must be > 0 for per_count"),
          { status: 400 }
        );
      }
    }

    if (nextPricingModel === "per_time") {
      if (nextPricePerMinute === null || nextPricePerMinute === undefined || Number(nextPricePerMinute) <= 0) {
        return NextResponse.json(
          errorResponse(ErrorCodes.BAD_REQUEST, "pricePerMinute required and must be > 0 for per_time"),
          { status: 400 }
        );
      }
    }

    const updated = await prisma.serviceInventory.update({
      where: { id },
      data: {
        name: typeof name === "string" ? name.trim() : undefined,
        serviceType: typeof serviceType === "string" ? serviceType : undefined,
        pricingModel: pricingModel ?? undefined,
        pricePerCount:
          nextPricingModel === "per_count"
            ? Number(pricePerCount ?? existing.pricePerCount)
            : null,
        pricePerMinute:
          nextPricingModel === "per_time"
            ? Number(pricePerMinute ?? existing.pricePerMinute)
            : null,
        description: description === undefined ? undefined : (description ? String(description) : null),
        isActive: typeof isActive === "boolean" ? isActive : undefined,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(
      successResponse({
        data: {
          service: updated,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH /api/services/[id] error:", error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update service"),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED), { status: 401 });
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ["admin", "manager"])) {
      return NextResponse.json(errorResponse(ErrorCodes.FORBIDDEN, "Insufficient permissions"), { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.serviceInventory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, "Service not found"), { status: 404 });
    }

    // Soft delete by deactivating
    await prisma.serviceInventory.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(
      successResponse({ data: { id }, message: "Service deleted" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/services/[id] error:", error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to delete service"),
      { status: 500 }
    );
  }
}

