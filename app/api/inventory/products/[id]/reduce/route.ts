/**
 * POST /api/inventory/products/[id]/reduce
 * Admin-only endpoint to reduce inventory item quantity
 * 
 * Body: { quantity: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { inventoryMovementService } from '@/services/inventory.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(request)
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: 401 }
      )
    }

    // Only admin can reduce inventory
    const userWithRoles = await loadUserWithRoles(ctx.userId)
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only admin can reduce inventory'),
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { quantity } = body

    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'quantity must be a positive number'),
        { status: 400 }
      )
    }

    // Get the product
    const product = await prisma.inventoryItem.findUnique({
      where: { id }
    })

    if (!product) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Product not found'),
        { status: 404 }
      )
    }

    // Get the restaurant department for DepartmentInventory reduction
    const restaurantDept = await prisma.department.findFirst({
      where: { code: 'restaurant' }
    })

    if (!restaurantDept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INTERNAL_ERROR, 'Restaurant department not found'),
        { status: 500 }
      )
    }

    // Check current stock in DepartmentInventory
    const deptInventory = await prisma.departmentInventory.findFirst({
      where: {
        inventoryItemId: id,
        departmentId: restaurantDept.id,
        sectionId: null
      }
    })

    if (!deptInventory || deptInventory.quantity < quantity) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Insufficient inventory to reduce'),
        { status: 400 }
      )
    }

    // Reduce in DepartmentInventory (source of truth)
    const updated = await prisma.departmentInventory.update({
      where: { id: deptInventory.id },
      data: {
        quantity: deptInventory.quantity - quantity
      }
    })

    // Log inventory movement for audit trail
    await inventoryMovementService.create({
      inventoryItemId: id,
      movementType: 'out',
      quantity: quantity,
      reason: `Manual inventory reduction by admin`,
      reference: `reduction-${ctx.userId}`
    })

    return NextResponse.json(
      successResponse({
        data: {
          product: product,
          message: `Reduced ${product.name} by ${quantity}. New quantity: ${updated.quantity}`
        }
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Error reducing inventory:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to reduce inventory'),
      { status: 500 }
    )
  }
}
