/**
 * Food & Drink Service
 * Handles all food and drink inventory and ordering
 */

import { BaseService } from './base.service';
import { IDrink, IFoodItem } from '../types/entities';
import { prisma } from '../lib/prisma';

// Helper mappers: convert Prisma results (which can contain nulls and Decimal) to
// the project's entity shapes (normalize null -> undefined, Decimal -> number/string).
function mapDrink(d: any): IDrink {
  if (!d) return d;
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? undefined,
    image: d.image ?? undefined,
    // some Prisma clients return Decimal for money fields — coerce to number
    price: typeof d.price === 'object' && typeof d.price.toNumber === 'function' ? d.price.toNumber() : Number(d.price),
    type: d.type ?? undefined,
    availability: Boolean(d.availability),
    quantity: d.quantity ?? 0,
    barStock: d.barStock ?? 0,
    restaurantStock: d.restaurantStock ?? 0,
    sold: d.sold ?? 0,
    supplied: d.supplied ?? 0,
    threshold: d.threshold ?? 0,
    drinkTypeId: d.drinkTypeId ?? (d.drinkType?.id ?? ''),
    bookingId: d.bookingId ?? undefined,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function mapDrinks(arr: any[] | null): IDrink[] {
  if (!arr) return [];
  return arr.map(mapDrink);
}

function mapFoodItem(f: any): IFoodItem {
  if (!f) return f;
  return {
    id: f.id,
    name: f.name,
    description: f.description ?? undefined,
    image: f.image ?? undefined,
    price: typeof f.price === 'object' && typeof f.price.toNumber === 'function' ? f.price.toNumber() : Number(f.price),
    availability: Boolean(f.availability),
    foodTypeId: f.foodTypeId ?? (f.foodType?.id ?? ''),
    menuCategoryId: f.menuCategoryId ?? (f.menuCategory?.id ?? ''),
    bookingId: f.bookingId ?? undefined,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

function mapFoodItems(arr: any[] | null): IFoodItem[] {
  if (!arr) return [];
  return arr.map(mapFoodItem);
}

export class DrinkService extends BaseService<IDrink> {
  constructor() {
    super('drink');
  }
  /**
   * Search drinks by name or description
   */
  async searchDrinks(query: string): Promise<IDrink[]> {
    const rows = await prisma.drink.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { drinkType: true, barAndClub: true },
      orderBy: { name: 'asc' },
    });
    return mapDrinks(rows);
  }

  /**
   * Get drinks for a specific bar/club
   */
  async getDrinksAtBar(barId: string): Promise<IDrink[]> {
    const rows = await prisma.drink.findMany({
      where: { barAndClubId: barId },
      include: { drinkType: true, barAndClub: true },
      orderBy: { name: 'asc' },
    });
    return mapDrinks(rows);
  }

  /**
   * Get available drinks
   */
  async getAvailableDrinks(): Promise<IDrink[]> {
    try {
      const rows = await prisma.drink.findMany({
        where: { availability: true },
        include: { drinkType: true },
      });
      return mapDrinks(rows);
    } catch (error) {
      console.error('Error fetching available drinks:', error);
      return [];
    }
  }

  /**
   * Get drinks by type
   */
  async getDrinksByType(drinkTypeId: string): Promise<IDrink[]> {
    try {
      const rows = await prisma.drink.findMany({
        where: { drinkTypeId },
        orderBy: { name: 'asc' },
      });
      return mapDrinks(rows);
    } catch (error) {
      console.error('Error fetching drinks by type:', error);
      return [];
    }
  }

  /**
   * Get low stock items
   * Accepts optional customThreshold; falls back to 10 if not provided
   */
  async getLowStockDrinks(customThreshold?: number): Promise<IDrink[]> {
    try {
      const threshold = typeof customThreshold === 'number' ? customThreshold : 10;
      const rows = await prisma.drink.findMany({
        where: {
          quantity: { lte: threshold },
        },
        include: { drinkType: true, barAndClub: true },
        orderBy: { quantity: 'asc' },
      });
      return mapDrinks(rows);
    } catch (error) {
      console.error('Error fetching low stock drinks:', error);
      return [];
    }
  }

  /**
   * Update drink stock
   */
  async updateStock(drinkId: string, quantity: number): Promise<IDrink | null> {
    try {
      const d = await prisma.drink.update({ where: { id: drinkId }, data: { quantity } });
      return mapDrink(d as any) as IDrink;
    } catch (error) {
      console.error('Error updating drink stock:', error);
      return null;
    }
  }

  /**
   * Get drink sales statistics
   */
  async getDrinkStats(): Promise<{
    totalDrinks: number;
    availableDrinks: number;
    lowStockDrinks: number;
    totalSold: number;
  } | null> {
    try {
      const [total, available, stats] = await Promise.all([
        prisma.drink.count(),
        prisma.drink.count({ where: { availability: true } }),
        prisma.drink.aggregate({
          _sum: { sold: true },
        }),
      ]);

      const lowStock = await prisma.drink.findMany({
        where: {
          quantity: { lte: 10 },
        },
      });

      return {
        totalDrinks: total,
        availableDrinks: available,
        lowStockDrinks: lowStock.length,
        totalSold: stats._sum.sold || 0,
      };
    } catch (error) {
      console.error('Error fetching drink stats:', error);
      return null;
    }
  }

  /**
   * Deplete drink stock (sale/usage)
   * Decrements main quantity and increments sold. Records a movement.
   */
  async depleteDrinkStock(drinkId: string, quantity: number, reference?: string): Promise<IDrink | null> {
    try {
      if (quantity <= 0) throw new Error('Depletion quantity must be positive');

      const drink = await prisma.drink.findUnique({ where: { id: drinkId } });
      if (!drink) throw new Error(`Drink not found: ${drinkId}`);
      if (drink.quantity < quantity) throw new Error('Insufficient stock');

      const updated = await prisma.$transaction(async (tx: any) => {
        const r = await tx.drink.update({
          where: { id: drinkId },
          data: {
            quantity: { decrement: quantity },
            sold: { increment: quantity },
          },
          include: { drinkType: true, barAndClub: true },
        });

        // Record movement (note: inventoryMovement.inventoryItemId references InventoryItem in schema,
        // but we record here for audit parity with other services; adapt schema if strict FK enforcement required)
        await (tx as any).inventoryMovement.create({
          data: {
            movementType: 'out',
            quantity,
            reason: 'Sale/Depletion',
            reference,
            inventoryItemId: drinkId,
          },
        });

        return r;
      });

      return mapDrink(updated as any) as IDrink;
    } catch (error) {
      console.error('Error depleting drink stock:', error);
      return null;
    }
  }

  /**
   * Allocate drink stock from main to bar/restaurant
   */
  async allocateDrinkStock(drinkId: string, quantity: number, toLocation: 'bar' | 'restaurant'): Promise<IDrink | null> {
    try {
      if (quantity <= 0) throw new Error('Allocation quantity must be positive');
      const drink = await prisma.drink.findUnique({ where: { id: drinkId } });
      if (!drink) throw new Error(`Drink not found: ${drinkId}`);
      if (drink.quantity < quantity) throw new Error('Insufficient main stock');

  const updated = await prisma.$transaction(async (tx: any) => {
        const locationField = toLocation === 'bar' ? 'barStock' : 'restaurantStock';
        const r = await tx.drink.update({
          where: { id: drinkId },
          data: {
            quantity: { decrement: quantity },
            [locationField]: { increment: quantity },
          },
          include: { drinkType: true, barAndClub: true },
        });

        await (tx as any).inventoryMovement.create({
          data: {
            movementType: 'in',
            quantity,
            reason: `Allocation to ${toLocation}`,
            inventoryItemId: drinkId,
          },
        });

        return r;
      });

      return mapDrink(updated as any) as IDrink;
    } catch (error) {
      console.error('Error allocating drink stock:', error);
      return null;
    }
  }

  /**
   * Transfer drink stock between locations
   */
  async transferDrinkStock(drinkId: string, quantity: number, fromLocation: 'bar' | 'restaurant' | 'main', toLocation: 'bar' | 'restaurant' | 'main'): Promise<IDrink | null> {
    try {
      if (quantity <= 0) throw new Error('Transfer quantity must be positive');
      if (fromLocation === toLocation) throw new Error('Source and destination cannot be the same');

      const drink = await prisma.drink.findUnique({ where: { id: drinkId } });
      if (!drink) throw new Error(`Drink not found: ${drinkId}`);

      const sourceQty = fromLocation === 'bar' ? drink.barStock : fromLocation === 'restaurant' ? drink.restaurantStock : drink.quantity;
      if (sourceQty < quantity) throw new Error('Insufficient source stock');

  const updated = await prisma.$transaction(async (tx: any) => {
        const updateData: Record<string, any> = {};
        if (fromLocation === 'bar') updateData.barStock = { decrement: quantity };
        else if (fromLocation === 'restaurant') updateData.restaurantStock = { decrement: quantity };
        else updateData.quantity = { decrement: quantity };

        if (toLocation === 'bar') updateData.barStock = { increment: quantity };
        else if (toLocation === 'restaurant') updateData.restaurantStock = { increment: quantity };
        else updateData.quantity = { increment: quantity };

        const r = await tx.drink.update({ where: { id: drinkId }, data: updateData, include: { drinkType: true, barAndClub: true } });

        await (tx as any).inventoryMovement.create({
          data: {
            movementType: 'in',
            quantity,
            reason: `Transfer from ${fromLocation} to ${toLocation}`,
            inventoryItemId: drinkId,
          },
        });

        return r;
      });

      return mapDrink(updated as any) as IDrink;
    } catch (error) {
      console.error('Error transferring drink stock:', error);
      return null;
    }
  }

  /**
   * Reserve drink stock for an order (creates inventory reservation)
   */
  async reserveDrinkStock(drinkId: string, quantity: number, orderId: string): Promise<IDrink | null> {
    try {
      if (quantity <= 0) throw new Error('Reservation quantity must be positive');
      const drink = await prisma.drink.findUnique({ where: { id: drinkId } });
      if (!drink) throw new Error(`Drink not found: ${drinkId}`);
      if (drink.quantity < quantity) throw new Error('Insufficient stock');

      // create reservation (use any-cast to avoid mismatched generated-client typing in some environments)
      await (prisma as any).inventoryReservation.create({ data: { inventoryItemId: drinkId, orderHeaderId: orderId, quantity, status: 'reserved' } });
      const d = await prisma.drink.findUnique({ where: { id: drinkId }, include: { drinkType: true, barAndClub: true } });
      return mapDrink(d as any) as IDrink;
    } catch (error) {
      console.error('Error reserving drink stock:', error);
      return null;
    }
  }

  /**
   * Confirm a drink reservation (depletes inventory and records movement)
   */
  async confirmDrinkReservation(reservationId: string): Promise<boolean> {
    try {
      const reservation = await (prisma as any).inventoryReservation.findUnique({ where: { id: reservationId } });
      if (!reservation) throw new Error('Reservation not found');

      await prisma.$transaction(async (tx: any) => {
        await tx.inventoryReservation.update({ where: { id: reservationId }, data: { status: 'confirmed', confirmedAt: new Date() } });
        await tx.drink.update({ where: { id: reservation.inventoryItemId }, data: { quantity: { decrement: reservation.quantity }, sold: { increment: reservation.quantity } } });
        await (tx as any).inventoryMovement.create({ data: { movementType: 'out', quantity: reservation.quantity, reason: 'Order fulfillment (reservation confirmed)', reference: reservation.orderHeaderId, inventoryItemId: reservation.inventoryItemId } });
      });

      return true;
    } catch (error) {
      console.error('Error confirming drink reservation:', error);
      return false;
    }
  }
}

export class FoodItemService extends BaseService<IFoodItem> {
  constructor() {
    super('foodItem');
  }

  /**
   * Get food items by restaurant
   */
  async getByRestaurant(restaurantId: string): Promise<IFoodItem[]> {
    const rows = await prisma.foodItem.findMany({
      where: { restaurantId },
      include: { foodType: true, menuCategory: true, restaurant: true },
      orderBy: { name: 'asc' },
    });
    return mapFoodItems(rows);
  }

  /**
   * Reserve food item stock for an order
   */
  async reserveFoodItemStock(foodItemId: string, quantity: number, orderId: string): Promise<IFoodItem | null> {
    if (quantity <= 0) throw new Error('Reservation quantity must be positive');
    const foodItem = await prisma.foodItem.findUnique({ where: { id: foodItemId } });
    if (!foodItem) throw new Error(`Food item not found: ${foodItemId}`);
    await (prisma as any).inventoryReservation.create({
      data: {
        inventoryItemId: foodItemId,
        orderHeaderId: orderId,
        quantity,
        status: 'reserved',
      },
    });
    const f = await prisma.foodItem.findUnique({ where: { id: foodItemId }, include: { foodType: true, menuCategory: true, restaurant: true } });
    return mapFoodItem(f as any) as IFoodItem;
  }

  /**
   * Confirm food item reservation
   */
  async confirmFoodItemReservation(reservationId: string): Promise<boolean> {
    const reservation = await (prisma as any).inventoryReservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new Error(`Reservation not found: ${reservationId}`);
    await prisma.$transaction(async (tx: any) => {
      await tx.inventoryReservation.update({
        where: { id: reservationId },
        data: { status: 'confirmed', confirmedAt: new Date() },
      });
      await (tx as any).inventoryMovement.create({
        data: {
          movementType: 'out',
          quantity: reservation.quantity,
          reason: 'Food item fulfillment (reservation confirmed)',
          reference: reservation.orderHeaderId,
          inventoryItemId: reservation.inventoryItemId,
        },
      });
    });
    return true;
  }

  /**
   * Search food items by name or description
   */
  async searchFoodItems(query: string): Promise<IFoodItem[]> {
    const rows = await prisma.foodItem.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { foodType: { typeName: { contains: query, mode: 'insensitive' } } },
          { menuCategory: { categoryName: { contains: query, mode: 'insensitive' } } },
        ],
      },
      include: { foodType: true, menuCategory: true, restaurant: true },
      orderBy: { name: 'asc' },
    });
    return mapFoodItems(rows);
  }

  /**
   * Get food item with full details
   */
  async getFoodItemWithDetails(foodItemId: string): Promise<IFoodItem | null> {
    const f = await prisma.foodItem.findUnique({
      where: { id: foodItemId },
      include: {
        foodType: true,
        menuCategory: true,
        restaurant: true,
        booking: true,
        bookingItems: true,
        productCounts: true,
      },
    });
    return mapFoodItem(f as any) as IFoodItem | null;
  }

  /**
   * Get available food items
   */
  async getAvailableFoodItems(): Promise<IFoodItem[]> {
    try {
      const rows = await prisma.foodItem.findMany({
        where: { availability: true },
        include: { foodType: true, menuCategory: true },
      });
      return mapFoodItems(rows);
    } catch (error) {
      console.error('Error fetching available food items:', error);
      return [];
    }
  }

  /**
   * Get food items by category
   */
  async getByCategory(menuCategoryId: string): Promise<IFoodItem[]> {
    try {
      const rows = await prisma.foodItem.findMany({
        where: { menuCategoryId },
        orderBy: { name: 'asc' },
      });
      return mapFoodItems(rows);
    } catch (error) {
      console.error('Error fetching food items by category:', error);
      return [];
    }
  }

  /**
   * Get food items by type
   */
  async getByFoodType(foodTypeId: string): Promise<IFoodItem[]> {
    try {
      const rows = await prisma.foodItem.findMany({
        where: { foodTypeId },
      });
      return mapFoodItems(rows);
    } catch (error) {
      console.error('Error fetching food items by type:', error);
      return [];
    }
  }

  /**
   * Get food items within price range
   */
  async getByPriceRange(minPrice: number, maxPrice: number): Promise<IFoodItem[]> {
    try {
      const rows = await prisma.foodItem.findMany({
        where: {
          price: {
            gte: minPrice,
            lte: maxPrice,
          },
        },
        orderBy: { price: 'asc' },
      });
      return mapFoodItems(rows);
    } catch (error) {
      console.error('Error fetching food items by price range:', error);
      return [];
    }
  }

  /**
   * Get food items statistics
   */
  async getFoodItemStats(): Promise<{
    totalItems: number;
    availableItems: number;
    categories: number;
    types: number;
  } | null> {
    try {
      const [totalItems, availableItems, categories, types] = await Promise.all([
        prisma.foodItem.count(),
        prisma.foodItem.count({ where: { availability: true } }),
        prisma.menuCategory.count(),
        prisma.foodType.count(),
      ]);

      return {
        totalItems,
        availableItems,
        categories,
        types,
      };
    } catch (error) {
      console.error('Error fetching food item stats:', error);
      return null;
    }
  }
}

export const drinkService = new DrinkService();
export const foodItemService = new FoodItemService();
