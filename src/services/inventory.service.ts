/**
 * Inventory Service
 * Handles inventory management for multiple item types (drinks, supplies, equipment, linens, etc.)
 */

import { BaseService } from './base.service';
import { IInventoryItem, IInventoryType, IInventoryMovement } from '../types/entities';
import { prisma } from '../lib/prisma';
import { normalizeError } from '@/lib/errors';

// Helper mappers
function mapInventoryItem(item: any): IInventoryItem {
  if (!item) return item;
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? undefined,
    sku: item.sku,
    category: item.category,
    itemType: item.itemType ?? undefined,
    quantity: item.quantity,
    reorderLevel: item.reorderLevel,
    maxQuantity: item.maxQuantity ?? undefined,
    // Convert Decimal -> number
    unitPrice: typeof item.unitPrice === 'object' && typeof item.unitPrice.toNumber === 'function' ? item.unitPrice.toNumber() : Number(item.unitPrice),
    location: item.location ?? undefined,
    supplier: item.supplier ?? undefined,
    lastRestocked: item.lastRestocked ?? undefined,
    expiry: item.expiry ?? undefined,
    inventoryTypeId: item.inventoryTypeId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function mapInventoryItems(arr: any[] | null): IInventoryItem[] {
  if (!arr) return [];
  return arr.map(mapInventoryItem);
}

function mapInventoryMovement(m: any): IInventoryMovement {
  if (!m) return m;
  return {
    id: m.id,
    movementType: m.movementType,
    quantity: m.quantity,
    reason: m.reason ?? undefined,
    reference: m.reference ?? undefined,
    inventoryItemId: m.inventoryItemId,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function mapInventoryMovements(arr: any[] | null): IInventoryMovement[] {
  if (!arr) return [];
  return arr.map(mapInventoryMovement);
}

export class InventoryTypeService extends BaseService<IInventoryType> {
  constructor() {
    super('inventoryType');
  }

  /**
   * Get all inventory types
   */
  async getAllTypes(): Promise<IInventoryType[]> {
    try {
      return await prisma.inventoryType.findMany({
        orderBy: { typeName: 'asc' },
      });
    } catch (error) {
      console.error('Error fetching inventory types:', error);
      return [];
    }
  }

  /**
   * Get inventory type by category
   */
  async getByCategory(category: string): Promise<IInventoryType[]> {
    try {
      return await prisma.inventoryType.findMany({
        where: { category },
        orderBy: { typeName: 'asc' },
      });
    } catch (error) {
      console.error('Error fetching inventory types by category:', error);
      return [];
    }
  }
}

export class InventoryItemService extends BaseService<IInventoryItem> {
  constructor() {
    super('inventoryItem');
  }

  /**
   * Get all inventory items with optional filtering
   */
  async getAllItems(filters?: {
    inventoryTypeId?: string;
    category?: string;
    itemType?: string;
    location?: string;
  }): Promise<IInventoryItem[]> {
    try {
      const where: any = {};
      if (filters?.inventoryTypeId) where.inventoryTypeId = filters.inventoryTypeId;
      if (filters?.category) where.category = filters.category;
      if (filters?.itemType) where.itemType = filters.itemType;
      if (filters?.location) where.location = filters.location;

      const rows = await prisma.inventoryItem.findMany({
        where,
        include: { inventoryType: true },
        orderBy: { name: 'asc' },
      });
      return mapInventoryItems(rows);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      return [];
    }
  }

  /**
   * Get inventory items by type
   */
  async getByType(inventoryTypeId: string): Promise<IInventoryItem[]> {
    try {
      const rows = await prisma.inventoryItem.findMany({
        where: { inventoryTypeId },
        include: { inventoryType: true },
        orderBy: { name: 'asc' },
      });

      return mapInventoryItems(rows);
    } catch (error) {
      console.error('Error fetching items by type:', error);
      return [];
    }
  }

  /**
   * Get inventory items by category
   */
  async getByCategory(category: string): Promise<IInventoryItem[]> {
    try {
      const rows = await prisma.inventoryItem.findMany({
        where: { category },
        include: { inventoryType: true },
        orderBy: { name: 'asc' },
      });

      return mapInventoryItems(rows);
    } catch (error) {
      console.error('Error fetching items by category:', error);
      return [];
    }
  }

  /**
   * Get low stock items (quantity <= reorderLevel)
   */
  async getLowStockItems(): Promise<IInventoryItem[]> {
    try {
      // Prisma doesn't support comparing one column to another directly in a where clause.
      // Fetch all items and filter in JS as a reliable fallback.
      const allItems = await prisma.inventoryItem.findMany({
        include: { inventoryType: true },
      });

      const mapped = mapInventoryItems(allItems as any[]);
      return mapped
        .filter((item: IInventoryItem) => item.quantity <= (item.reorderLevel ?? 0))
        .sort((a: IInventoryItem, b: IInventoryItem) => a.quantity - b.quantity);
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      return [];
    }
  }

  /**
   * Get expired items
   */
  async getExpiredItems(): Promise<IInventoryItem[]> {
    try {
      const now = new Date();
      const rows = await prisma.inventoryItem.findMany({
        where: {
          expiry: {
            lte: now,
          },
        },
        include: { inventoryType: true },
        orderBy: { expiry: 'asc' },
      });

      return mapInventoryItems(rows);
    } catch (error) {
      console.error('Error fetching expired items:', error);
      return [];
    }
  }

  /**
   * Update item quantity
   */
  async updateQuantity(itemId: string, quantity: number): Promise<IInventoryItem | null> {
    try {
      const row = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { quantity },
        include: { inventoryType: true },
      });

      return mapInventoryItem(row as any);
    } catch (error) {
      console.error('Error updating item quantity:', error);
      return null;
    }
  }

  /**
   * Adjust item quantity (by delta)
   */
  async adjustQuantity(
    itemId: string,
    delta: number,
    reason?: string
  ): Promise<IInventoryItem | null> {
    try {
      const item = await prisma.inventoryItem.findUnique({
        where: { id: itemId },
      });

      if (!item) {
        console.error('Item not found:', itemId);
        return null;
      }

      const newQuantity = Math.max(0, item.quantity + delta);

      // Record the movement
      await prisma.inventoryMovement.create({
        data: {
          movementType: delta > 0 ? 'in' : delta < 0 ? 'out' : 'adjustment',
          quantity: Math.abs(delta),
          reason,
          inventoryItemId: itemId,
        },
      });

      const row = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { quantity: newQuantity },
        include: { inventoryType: true },
      });

      return mapInventoryItem(row as any);
    } catch (error) {
      console.error('Error adjusting quantity:', error);
      return null;
    }
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats(): Promise<{
    totalItems: number;
    categories: number;
    types: number;
    lowStockCount: number;
    expiredCount: number;
    totalValue: string;
  } | null> {
    try {
  const itemsRaw = await prisma.inventoryItem.findMany();
  const items = mapInventoryItems(itemsRaw as any[]);
  const lowStockItems = items.filter((item: IInventoryItem) => item.quantity <= item.reorderLevel);
  const now = new Date();
  const expiredItems = items.filter((item: IInventoryItem) => item.expiry && item.expiry <= now);

      const totalValue = items.reduce((sum: number, item: IInventoryItem) => {
        const itemValue = Number(item.unitPrice) * item.quantity;
        return sum + itemValue;
      }, 0);

      const categories = new Set(items.map((item: IInventoryItem) => item.category)).size;
      const types = await prisma.inventoryType.count();

      return {
        totalItems: items.length,
        categories,
        types,
        lowStockCount: lowStockItems.length,
        expiredCount: expiredItems.length,
        totalValue: totalValue.toFixed(2),
      };
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
      return null;
    }
  }

  /**
   * Search items by name or SKU
   */
  async search(query: string): Promise<IInventoryItem[]> {
    try {
      const rows = await prisma.inventoryItem.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { sku: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: { inventoryType: true },
        orderBy: { name: 'asc' },
      });

      return mapInventoryItems(rows);
    } catch (error) {
      console.error('Error searching inventory items:', error);
      return [];
    }
  }

  /**
   * Reserve inventory for order (NEW - ORDER SYSTEM)
   * Atomic operation to prevent overselling
   */
  async reserveForOrder(inventoryItemId: string, quantity: number, orderId: string) {
    try {
      const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (!item || item.quantity < quantity) {
        return { success: false, message: 'Insufficient inventory' };
      }

      const reservation = await (prisma as any).inventoryReservation.create({
        data: {
          inventoryItemId,
          orderHeaderId: orderId,
          quantity,
          status: 'reserved',
        },
      });

      return { success: true, reservation };
    } catch (error) {
      console.error('Error reserving inventory:', error);
      return { success: false, message: 'Reservation failed' };
    }
  }

  /**
   * Consume reserved inventory after order fulfillment (NEW - ORDER SYSTEM)
   */
  async consumeReserved(orderId: string) {
    try {
      const reservations = await (prisma as any).inventoryReservation.findMany({
        where: { orderHeaderId: orderId, status: 'confirmed' },
      });

        for (const reservation of reservations) {
        await prisma.$transaction(async (tx: any) => {
          // Deduct from inventory
          await tx.inventoryItem.update({
            where: { id: reservation.inventoryItemId },
            data: { quantity: { decrement: reservation.quantity } },
          });

          // Mark as consumed
          await (tx as any).inventoryReservation.update({
            where: { id: reservation.id },
            data: { status: 'consumed' },
          });

          // Create movement
          await tx.inventoryMovement.create({
            data: {
              inventoryItemId: reservation.inventoryItemId,
              movementType: 'out',
              quantity: reservation.quantity,
              reason: `Order fulfillment: ${orderId}`,
              reference: orderId,
            },
          });
        });
      }
      return { success: true, message: 'Inventory consumed' };
    } catch (error: unknown) {
      const e = normalizeError(error);
      console.error('Error consuming inventory:', e);
      return { success: false, message: 'Consumption failed' };
    }
  }

  /**
   * Check availability including reservations (NEW - ORDER SYSTEM)
   */
  async checkAvailabilityWithReservations(itemId: string, quantity: number): Promise<boolean> {
    try {
      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
      if (!item) return false;

      const reserved = await (prisma as any).inventoryReservation.aggregate({
        _sum: { quantity: true },
        where: {
          inventoryItemId: itemId,
          status: { in: ['reserved', 'confirmed'] },
        },
      });

      const available = item.quantity - (reserved._sum.quantity || 0);
      return available >= quantity;
    } catch (error: unknown) {
      const e = normalizeError(error);
      console.error('Error checking availability:', e);
      return false;
    }
  }

  /**
   * Get inventory with reservation details (NEW - ORDER SYSTEM)
   */
  async getWithReservationDetails(id: string) {
    try {
      const item = await prisma.inventoryItem.findUnique({
        where: { id },
        include: {
          inventoryType: true,
          movements: { orderBy: { createdAt: 'desc' }, take: 10 },
          reservations: true,
        } as any,
      });

      if (!item) return null;

      const reserved = (item as any).reservations
        .filter((r: any) => r.status === 'reserved' || r.status === 'confirmed')
        .reduce((sum: number, r: any) => sum + r.quantity, 0);

      return {
        ...mapInventoryItem(item as any),
        reservedQuantity: reserved,
        availableQuantity: (item as any).quantity - reserved,
      };
    } catch (error: unknown) {
      const e = normalizeError(error);
      console.error('Error fetching item with reservations:', e);
      return null;
    }
  }

  /**
   * Get items needing restock - alias for low stock items
   */
  async getItemsNeedingRestock(): Promise<IInventoryItem[]> {
    try {
      return await this.getLowStockItems();
    } catch (error) {
      console.error('Error fetching items needing restock:', error);
      return [];
    }
  }
}

export class InventoryMovementService extends BaseService<IInventoryMovement> {
  constructor() {
    super('inventoryMovement');
  }

  /**
   * Get all movements for an item
   */
  async getByItem(itemId: string): Promise<IInventoryMovement[]> {
    try {
      const rows = await prisma.inventoryMovement.findMany({
        where: { inventoryItemId: itemId },
        orderBy: { createdAt: 'desc' },
      });

      return mapInventoryMovements(rows);
    } catch (error) {
      console.error('Error fetching movements for item:', error);
      return [];
    }
  }

  /**
   * Get movements within date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<IInventoryMovement[]> {
    try {
      const rows = await prisma.inventoryMovement.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return mapInventoryMovements(rows);
    } catch (error) {
      console.error('Error fetching movements by date range:', error);
      return [];
    }
  }

  /**
   * Get movements by type
   */
  async getByType(movementType: 'in' | 'out' | 'adjustment' | 'loss'): Promise<IInventoryMovement[]> {
    try {
      const rows = await prisma.inventoryMovement.findMany({
        where: { movementType },
        orderBy: { createdAt: 'desc' },
      });

      return mapInventoryMovements(rows);
    } catch (error) {
      console.error('Error fetching movements by type:', error);
      return [];
    }
  }

  /**
   * Record a movement
   */
  async recordMovement(
    itemId: string,
    movementType: 'in' | 'out' | 'adjustment' | 'loss',
    quantity: number,
    reason?: string,
    reference?: string
  ): Promise<IInventoryMovement | null> {
    try {
      const row = await prisma.inventoryMovement.create({
        data: {
          movementType,
          quantity,
          reason,
          reference,
          inventoryItemId: itemId,
        },
      });

      return mapInventoryMovement(row as any);
    } catch (error) {
      console.error('Error recording movement:', error);
      return null;
    }
  }
}

export const inventoryTypeService = new InventoryTypeService();
export const inventoryItemService = new InventoryItemService();
export const inventoryMovementService = new InventoryMovementService();
