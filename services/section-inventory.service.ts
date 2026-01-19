import { prisma } from '@/lib/auth/prisma'
import { prismaDecimalToCents } from '@/lib/price'

/**
 * Section Inventory Service
 * Manages inventory tracking and audits at the section level
 * Sections have independent stock from parent departments
 */
export class SectionInventoryService {
  /**
   * Get inventory for a specific section
   * Returns all items with quantities for that section
   */
  async getSectionInventory(sectionCode: string) {
    try {
      const parts = sectionCode.split(':')
      if (parts.length < 2) {
        return { success: false, message: 'Invalid section code format (expected PARENT:slug)' }
      }

      const parentCode = parts[0]
      const sectionSlugOrId = parts.slice(1).join(':')

      // Find parent department
      const parentDept = await prisma.department.findUnique({ 
        where: { code: parentCode },
        include: { 
          sections: { 
            where: { 
              OR: [
                { slug: sectionSlugOrId },
                { id: sectionSlugOrId }
              ]
            }
          }
        }
      })

      if (!parentDept) {
        return { success: false, message: 'Parent department not found' }
      }

      const section = parentDept.sections[0]
      if (!section) {
        return { success: false, message: 'Section not found' }
      }

      // Get all inventory records for this section
      const inventories = await prisma.departmentInventory.findMany({
        where: { 
          sectionId: section.id
        },
        include: {
          inventoryItem: true
        }
      })

      return {
        success: true,
        data: {
          section: {
            id: section.id,
            code: sectionCode,
            name: section.name,
            slug: section.slug
          },
          inventories: inventories.map(inv => ({
            id: inv.id,
            itemId: inv.inventoryItemId,
            itemName: inv.inventoryItem.name,
            itemSku: inv.inventoryItem.sku,
            quantity: inv.quantity,
            reserved: inv.reserved,
            available: inv.quantity - inv.reserved,
            unitPrice: inv.unitPrice ? prismaDecimalToCents(inv.unitPrice) : null,
            category: inv.inventoryItem.category
          }))
        }
      }
    } catch (error) {
      console.error('getSectionInventory error:', error)
      return { success: false, message: 'Failed to fetch section inventory' }
    }
  }

  /**
   * Get inventory audit trail for a section
   * Shows all incoming/outgoing transfers and adjustments
   */
  async getSectionInventoryAudit(sectionCode: string, filters?: {
    itemId?: string
    movementType?: 'in' | 'out' | 'adjustment' | 'loss'
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }) {
    try {
      const parts = sectionCode.split(':')
      if (parts.length < 2) {
        return { success: false, message: 'Invalid section code format' }
      }

      const parentCode = parts[0]
      const sectionSlugOrId = parts.slice(1).join(':')

      const parentDept = await prisma.department.findUnique({ 
        where: { code: parentCode }
      })

      if (!parentDept) {
        return { success: false, message: 'Parent department not found' }
      }

      const section = await prisma.departmentSection.findFirst({
        where: {
          departmentId: parentDept.id,
          OR: [
            { slug: sectionSlugOrId },
            { id: sectionSlugOrId }
          ]
        }
      })

      if (!section) {
        return { success: false, message: 'Section not found' }
      }

      // Get transfers where destination was this section
      const transfers = await prisma.departmentTransfer.findMany({
        where: {
          toDepartmentId: parentDept.id,
          status: 'completed',
          createdAt: {
            gte: filters?.startDate,
            lte: filters?.endDate
          }
        },
        include: {
          items: filters?.itemId ? { where: { productId: filters.itemId } } : undefined,
          fromDepartment: true,
          toDepartment: true
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0
      })

      // Filter transfers that mention this section in notes
      const sectionTransfers = transfers.filter(t => {
        try {
          if (t.notes) {
            const parsed = JSON.parse(t.notes)
            return parsed.toDepartmentCode === sectionCode
          }
        } catch (e) {}
        return false
      })

      return {
        success: true,
        data: {
          section: {
            code: sectionCode,
            name: section.name,
            id: section.id
          },
          incomingTransfers: sectionTransfers.map(t => ({
            id: t.id,
            fromDepartment: t.fromDepartment.name,
            fromCode: t.fromDepartment.code,
            items: t.items.map(item => ({
              productId: item.productId,
              productType: item.productType,
              quantity: item.quantity
            })),
            status: t.status,
            createdAt: t.createdAt,
            completedAt: t.updatedAt,
            notes: t.notes
          })),
          total: sectionTransfers.length
        }
      }
    } catch (error) {
      console.error('getSectionInventoryAudit error:', error)
      return { success: false, message: 'Failed to fetch section audit trail' }
    }
  }

  /**
   * Get section stock summary
   * Counts items by availability status
   */
  async getSectionStockSummary(sectionCode: string) {
    try {
      const parts = sectionCode.split(':')
      if (parts.length < 2) {
        return { success: false, message: 'Invalid section code format' }
      }

      const parentCode = parts[0]
      const sectionSlugOrId = parts.slice(1).join(':')

      const parentDept = await prisma.department.findUnique({
        where: { code: parentCode }
      })

      if (!parentDept) {
        return { success: false, message: 'Parent department not found' }
      }

      const section = await prisma.departmentSection.findFirst({
        where: {
          departmentId: parentDept.id,
          OR: [
            { slug: sectionSlugOrId },
            { id: sectionSlugOrId }
          ]
        }
      })

      if (!section) {
        return { success: false, message: 'Section not found' }
      }

      // Get all inventory for section
      const inventories = await prisma.departmentInventory.findMany({
        where: { sectionId: section.id },
        include: { inventoryItem: true }
      })

      // Categorize by status
      let empty = 0
      let low = 0
      let high = 0
      let totalValue = 0

      for (const inv of inventories) {
        const qty = inv.quantity ?? 0
        const threshold = inv.inventoryItem.reorderLevel ?? 10
        const unitPrice = inv.unitPrice ? prismaDecimalToCents(inv.unitPrice) : 0

        if (qty <= 0) {
          empty += 1
        } else if (qty <= threshold) {
          low += 1
        } else {
          high += 1
        }

        totalValue += qty * unitPrice
      }

      return {
        success: true,
        data: {
          section: {
            code: sectionCode,
            name: section.name,
            id: section.id
          },
          summary: {
            available: high,
            lowStock: low,
            outOfStock: empty,
            totalItems: inventories.length,
            totalValue,
            totalQuantity: inventories.reduce((sum, inv) => sum + inv.quantity, 0)
          }
        }
      }
    } catch (error) {
      console.error('getSectionStockSummary error:', error)
      return { success: false, message: 'Failed to fetch stock summary' }
    }
  }

  /**
   * Adjust section inventory directly (e.g., for stock takes, damage, etc.)
   */
  async adjustSectionInventory(
    sectionCode: string,
    itemId: string,
    delta: number,
    reason: string,
    reference?: string
  ) {
    try {
      const parts = sectionCode.split(':')
      if (parts.length < 2) {
        return { success: false, message: 'Invalid section code format' }
      }

      const parentCode = parts[0]
      const sectionSlugOrId = parts.slice(1).join(':')

      const parentDept = await prisma.department.findUnique({
        where: { code: parentCode }
      })

      if (!parentDept) {
        return { success: false, message: 'Parent department not found' }
      }

      const section = await prisma.departmentSection.findFirst({
        where: {
          departmentId: parentDept.id,
          OR: [
            { slug: sectionSlugOrId },
            { id: sectionSlugOrId }
          ]
        }
      })

      if (!section) {
        return { success: false, message: 'Section not found' }
      }

      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } })
      if (!item) {
        return { success: false, message: 'Inventory item not found' }
      }

      // Update or create inventory record
      const existing = await prisma.departmentInventory.findUnique({
        where: {
          departmentId_sectionId_inventoryItemId: {
            departmentId: parentDept.id,
            sectionId: section.id,
            inventoryItemId: itemId
          }
        }
      })

      let updated: any
      if (existing) {
        const newQty = Math.max(0, existing.quantity + delta)
        updated = await prisma.departmentInventory.update({
          where: { id: existing.id },
          data: { quantity: newQty }
        })
      } else {
        if (delta < 0) {
          return { success: false, message: 'Cannot adjust inventory to negative when no record exists' }
        }
        updated = await prisma.departmentInventory.create({
          data: {
            departmentId: parentDept.id,
            sectionId: section.id,
            inventoryItemId: itemId,
            quantity: delta
          }
        })
      }

      // Record movement
      const movementType = delta > 0 ? 'in' : delta < 0 ? 'out' : 'adjustment'
      await prisma.inventoryMovement.create({
        data: {
          movementType,
          quantity: Math.abs(delta),
          reason,
          reference: reference || sectionCode,
          inventoryItemId: itemId
        }
      })

      return {
        success: true,
        message: `Adjusted ${item.name} by ${delta} units in section ${sectionCode}`,
        data: updated
      }
    } catch (error) {
      console.error('adjustSectionInventory error:', error)
      return { success: false, message: 'Failed to adjust inventory' }
    }
  }
}

export const sectionInventoryService = new SectionInventoryService()
