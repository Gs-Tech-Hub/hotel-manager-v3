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

    // Reduce the quantity
    const newQuantity = Math.max(0, product.quantity - quantity)
    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        quantity: newQuantity
      }
    })

    return NextResponse.json(
      successResponse({
        data: {
          product: updated,
          message: `Reduced ${product.name} by ${quantity}. New quantity: ${newQuantity}`
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
