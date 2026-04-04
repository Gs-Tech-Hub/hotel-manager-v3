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
   * 
   * @param productType - 'drink' or 'inventoryItem'
   * @param productId - The product ID
   * @param departmentId - The department ID
   * @param sectionId - Optional section ID (if checking section-level stock)
   * @returns Balance in DepartmentInventory, or 0 if not found
   */
  async getBalance(productType: string, productId: string, departmentId: string, sectionId?: string | null): Promise<number> {
    if (!productId || !departmentId) return 0

    // Normalize sectionId: convert string 'null' to actual null
    const normalizedSectionId = sectionId === 'null' ? null : sectionId;

    // SINGLE SOURCE OF TRUTH: DepartmentInventory only
    // No fallback to legacy tables (Drink.barStock, InventoryItem.quantity)
    // This ensures display and transfer validation use the same source
    try {
      const record = await prisma.departmentInventory.findFirst({
        where: {
          departmentId,
          inventoryItemId: productId,
          sectionId: normalizedSectionId === undefined ? null : normalizedSectionId,
        },
      })

      if (record) return record.quantity ?? 0
    } catch (e) {
      console.error(`[STOCK] getBalance error for ${productType}/${productId}:`, e)
    }

    // If no record in DepartmentInventory, return 0
    // Do NOT fall back to legacy tables - they are not authoritative
    return 0
  }

  /**
   * Batch get balances for multiple products.
   * More efficient than calling getBalance() multiple times.
   * 
   * @param productType - 'drink' or 'inventoryItem'
   * @param productIds - Array of product IDs
   * @param departmentId - The department ID (or null for consolidated across all depts)
   * @param sectionId - Optional section ID
   * @returns Map of productId -> balance
   */
  async getBalances(
    productType: string,
    productIds: string[],
    departmentId: string | null,
    sectionId?: string | null
  ): Promise<Map<string, number>> {
    const balances = new Map<string, number>()

    if (!productIds.length) return balances

    // Normalize sectionId: convert string 'null' to actual null
    const normalizedSectionId = sectionId === 'null' ? null : sectionId;

    // If departmentId is null, sum across all departments (consolidated inventory)
    if (departmentId === null) {
      const totals = await prisma.departmentInventory.groupBy({
        by: ['inventoryItemId'],
        where: {
          inventoryItemId: { in: productIds },
          sectionId: null,  // ALWAYS exclude sections for consolidated inventory
        },
        _sum: {
          quantity: true,
        },
      });

      console.log(`[STOCK] getBalances consolidated query found ${totals.length} items`);
      
      for (const total of totals) {
        balances.set(total.inventoryItemId, total._sum.quantity ?? 0);
      }

      // Set missing IDs to 0
      for (const id of productIds) {
        if (!balances.has(id)) {
          balances.set(id, 0);
        }
      }

      return balances;
    }

    // Get from DepartmentInventory first (specific department)
    const whereClause = {
      departmentId,
      inventoryItemId: { in: productIds },
      sectionId: normalizedSectionId === undefined ? null : normalizedSectionId,
    };
    
    // Debug: Log what we're querying
    console.log(`[STOCK] getBalances query:`, {
      productType,
      productIds: productIds.slice(0, 3), // First 3 IDs
      departmentId,
      sectionId: sectionId || 'null',
      whereClause,
    });
    
    const deptInvRecords = await prisma.departmentInventory.findMany({
      where: whereClause,
    });
    
    console.log(`[STOCK] getBalances found ${deptInvRecords.length} records:`, 
      deptInvRecords.slice(0, 3).map((r: any) => ({
        inventoryItemId: r.inventoryItemId,
        quantity: r.quantity,
        sectionId: r.sectionId,
      }))
    );

    const foundInDeptInv = new Set<string>()
    for (const record of deptInvRecords) {
      balances.set(record.inventoryItemId, record.quantity ?? 0)
      foundInDeptInv.add(record.inventoryItemId)
    }

    // For products not found in DepartmentInventory, return 0
    // Do NOT fall back to legacy tables - they are not authoritative
    // SINGLE SOURCE OF TRUTH: DepartmentInventory only
    const missingIds = productIds.filter((id) => !foundInDeptInv.has(id))
    for (const id of missingIds) {
      balances.set(id, 0)
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
    departmentId: string | null,
    requiredQuantity: number,
    sectionId?: string | null
  ): Promise<{ hasStock: boolean; available: number; required: number; message?: string }> {
    // For consolidated mode (departmentId === null), use getBalances to sum across all depts
    let available: number
    if (departmentId === null) {
      const balances = await this.getBalances(productType, [productId], null, sectionId)
      available = balances.get(productId) ?? 0
    } else {
      available = await this.getBalance(productType, productId, departmentId, sectionId)
    }
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
    departmentId: string | null,
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
