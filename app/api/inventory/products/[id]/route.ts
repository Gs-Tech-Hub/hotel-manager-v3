/**
 * DELETE /api/inventory/products/[id]
 * Admin-only endpoint to delete inventory items
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'

export async function DELETE(
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

    // Only admin can delete products
    const userWithRoles = await loadUserWithRoles(ctx.userId)
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only admin can delete products'),
        { status: 403 }
      )
    }

    const { id } = await params

    const product = await prisma.inventoryItem.findUnique({
      where: { id }
    })

    if (!product) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Product not found'),
        { status: 404 }
      )
    }

    // Soft delete by setting deletedAt
    const deleted = await prisma.inventoryItem.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    })

    return NextResponse.json(
      successResponse({
        data: { id },
        message: `Product "${product.name}" has been deleted`
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to delete product'),
      { status: 500 }
    )
  }
}
