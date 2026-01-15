import { prisma } from '@/lib/auth/prisma'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * Stock Consolidation Service
 * 
 * UNIFIED SINGLE SOURCE OF TRUTH FOR ALL INVENTORY BALANCE QUERIES
 * 
 * This service ensures all stock queries (display, validation, transfer) read from the same source.
 * Architecture:
 * - DepartmentInventory.quantity is the AUTHORITATIVE source for department-level stock
 * - Drink.barStock, Drink.quantity, etc. are LEGACY and should NOT be queried directly
 * - All transfers update DepartmentInventory only
 * - All stock reads must go through this service with proper fallback handling
 */
export class StockService {
  /**
   * Get the current balance for a product in a department/section.
   * This is the CANONICAL way to check stock levels.
   * 
   * @param productType - 'drink' or 'inventoryItem'
   * @param productId - The product ID
   * @param departmentId - The department ID
   * @param sectionId - Optional section ID (if checking section-level stock)
   * @returns Balance in DepartmentInventory, or 0 if not found
   */
  async getBalance(productType: string, productId: string, departmentId: string, sectionId?: string | null): Promise<number> {
    if (!productId || !departmentId) return 0

    // First, check DepartmentInventory (the authoritative source)
    try {
      // For drinks and inventoryItems, they're tracked in DepartmentInventory by inventoryItemId
      const record = await prisma.departmentInventory.findFirst({
        where: {
          departmentId,
          inventoryItemId: productId,
          sectionId: sectionId ?? undefined, // Pass undefined for "any null/undefined value"
        },
      })

      if (record) return record.quantity ?? 0
    } catch (e) {
      // DepartmentInventory query failed, will fall back below
    }

    // If no DepartmentInventory record exists, fall back to legacy tables (for backward compatibility)
    // But initialize DepartmentInventory from legacy data on first access
    if (productType === 'drink') {
      const drink = await prisma.drink.findUnique({ where: { id: productId } })
      if (drink) {
        const legacyBalance = drink.barStock ?? drink.quantity ?? 0

        // Initialize DepartmentInventory from legacy data if it doesn't exist
        if (legacyBalance > 0) {
          try {
            const createData: any = {
              departmentId,
              inventoryItemId: productId,
              quantity: legacyBalance,
            }
            if (sectionId) createData.sectionId = sectionId
            // unitPrice needs to be Decimal type
            if (drink.price) {
              createData.unitPrice = new Decimal(Math.round(Number(drink.price) * 100) / 100)
            }

            // For upsert with nullable sectionId, we need to query first
            const existing = await prisma.departmentInventory.findFirst({
              where: {
                departmentId,
                sectionId: sectionId ?? undefined,
                inventoryItemId: productId,
              },
            })

            if (existing) {
              await prisma.departmentInventory.update({
                where: { id: existing.id },
                data: { quantity: legacyBalance },
              })
            } else {
              await prisma.departmentInventory.create({
                data: createData,
              })
            }
          } catch (e) {
            // Initialization failed, just return the legacy value
          }
        }

        return legacyBalance
      }
    } else if (productType === 'inventoryItem') {
      const inv = await prisma.inventoryItem.findUnique({ where: { id: productId } })
      if (inv) {
        const legacyBalance = inv.quantity ?? 0

        // Initialize DepartmentInventory from legacy data if it doesn't exist
        if (legacyBalance > 0) {
          try {
            const createData: any = {
              departmentId,
              inventoryItemId: productId,
              quantity: legacyBalance,
            }
            if (sectionId) createData.sectionId = sectionId
            if (inv.unitPrice) {
              createData.unitPrice = inv.unitPrice
            }

            // For upsert with nullable sectionId, we need to query first
            const existing = await prisma.departmentInventory.findFirst({
              where: {
                departmentId,
                sectionId: sectionId ?? undefined,
                inventoryItemId: productId,
              },
            })

            if (existing) {
              await prisma.departmentInventory.update({
                where: { id: existing.id },
                data: { quantity: legacyBalance },
              })
            } else {
              await prisma.departmentInventory.create({
                data: createData,
              })
            }
          } catch (e) {
            // Initialization failed, just return the legacy value
          }
        }

        return legacyBalance
      }
    }

    return 0
  }

  /**
   * Batch get balances for multiple products.
   * More efficient than calling getBalance() multiple times.
   * 
   * @param productType - 'drink' or 'inventoryItem'
   * @param productIds - Array of product IDs
   * @param departmentId - The department ID
   * @param sectionId - Optional section ID
   * @returns Map of productId -> balance
   */
  async getBalances(
    productType: string,
    productIds: string[],
    departmentId: string,
    sectionId?: string | null
  ): Promise<Map<string, number>> {
    const balances = new Map<string, number>()

    if (!productIds.length) return balances

    // Get from DepartmentInventory first
    const deptInvRecords = await prisma.departmentInventory.findMany({
      where: {
        departmentId,
        inventoryItemId: { in: productIds },
        sectionId: sectionId ?? undefined,
      },
    })

    const foundInDeptInv = new Set<string>()
    for (const record of deptInvRecords) {
      balances.set(record.inventoryItemId, record.quantity ?? 0)
      foundInDeptInv.add(record.inventoryItemId)
    }

    // For products not found in DepartmentInventory, check legacy tables
    const missingIds = productIds.filter((id) => !foundInDeptInv.has(id))

    if (missingIds.length > 0) {
      if (productType === 'drink') {
        const drinks = await prisma.drink.findMany({
          where: { id: { in: missingIds } },
        })

        for (const drink of drinks) {
          const legacyBalance = drink.barStock ?? drink.quantity ?? 0
          balances.set(drink.id, legacyBalance)

          // Initialize DepartmentInventory from legacy data
          if (legacyBalance > 0) {
            try {
              const createData: any = {
                departmentId,
                inventoryItemId: drink.id,
                quantity: legacyBalance,
              }
              if (sectionId) createData.sectionId = sectionId
              if (drink.price) {
                createData.unitPrice = new Decimal(Math.round(Number(drink.price) * 100) / 100)
              }

              await (prisma as any).departmentInventory.upsert({
                where: {
                  departmentId_sectionId_inventoryItemId: {
                    departmentId,
                    sectionId: sectionId || null,
                    inventoryItemId: drink.id,
                  },
                },
                update: { quantity: legacyBalance },
                create: createData,
              })
            } catch (e) {
              // Initialization failed, continue
            }
          }
        }
      } else if (productType === 'inventoryItem') {
        const items = await prisma.inventoryItem.findMany({
          where: { id: { in: missingIds } },
        })

        for (const item of items) {
          const legacyBalance = item.quantity ?? 0
          balances.set(item.id, legacyBalance)

          // Initialize DepartmentInventory from legacy data
          if (legacyBalance > 0) {
            try {
              const createData: any = {
                departmentId,
                inventoryItemId: item.id,
                quantity: legacyBalance,
              }
              if (sectionId) createData.sectionId = sectionId
              if (item.unitPrice) {
                createData.unitPrice = item.unitPrice
              }

              await (prisma as any).departmentInventory.upsert({
                where: {
                  departmentId_sectionId_inventoryItemId: {
                    departmentId,
                    sectionId: sectionId || null,
                    inventoryItemId: item.id,
                  },
                },
                update: { quantity: legacyBalance },
                create: createData,
              })
            } catch (e) {
              // Initialization failed, continue
            }
          }
        }
      }
    }

    // Ensure all product IDs have an entry (default to 0 if not found)
    for (const productId of productIds) {
      if (!balances.has(productId)) {
        balances.set(productId, 0)
      }
    }

    return balances
  }

  /**
   * Check if a product has sufficient stock in a department/section.
   * This is the CANONICAL validation method for transfers.
   * 
   * @param productType - 'drink' or 'inventoryItem'
   * @param productId - The product ID
   * @param departmentId - The department ID
   * @param requiredQuantity - How much we need
   * @param sectionId - Optional section ID
   * @returns { hasStock: boolean, available: number, required: number }
   */
  async checkAvailability(
    productType: string,
    productId: string,
    departmentId: string,
    requiredQuantity: number,
    sectionId?: string | null
  ): Promise<{ hasStock: boolean; available: number; required: number; message?: string }> {
    const available = await this.getBalance(productType, productId, departmentId, sectionId)
    const hasStock = available >= requiredQuantity

    return {
      hasStock,
      available,
      required: requiredQuantity,
      message: hasStock ? undefined : `Insufficient stock: have ${available}, need ${requiredQuantity}`,
    }
  }

  /**
   * Batch check availability for multiple products.
   * 
   * @param productType - 'drink' or 'inventoryItem'
   * @param items - Array of { productId, requiredQuantity }
   * @param departmentId - The department ID
   * @param sectionId - Optional section ID
   * @returns Array of { productId, hasStock, available, required }
   */
  async checkAvailabilityBatch(
    productType: string,
    items: Array<{ productId: string; requiredQuantity: number }>,
    departmentId: string,
    sectionId?: string | null
  ): Promise<Array<{ productId: string; hasStock: boolean; available: number; required: number; message?: string }>> {
    const productIds = items.map((i) => i.productId)
    const balances = await this.getBalances(productType, productIds, departmentId, sectionId)

    return items.map((item) => {
      const available = balances.get(item.productId) ?? 0
      const hasStock = available >= item.requiredQuantity

      return {
        productId: item.productId,
        hasStock,
        available,
        required: item.requiredQuantity,
        message: hasStock ? undefined : `Insufficient stock: have ${available}, need ${item.requiredQuantity}`,
      }
    })
  }
}

export const stockService = new StockService()
