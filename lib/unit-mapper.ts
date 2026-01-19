/**
 * Unit mapper for inventory items
 * Maps category/itemType to appropriate display units
 */

const CATEGORY_UNIT_MAP: Record<string, string> = {
  // Beverages
  'drinks': 'bottles',
  'beverages': 'bottles',
  'spirits': 'bottles',
  'wine': 'bottles',
  'beer': 'bottles',
  'soft drinks': 'bottles',
  
  // Food items
  'food': 'servings',
  'ingredients': 'units',
  'spices': 'grams',
  'dairy': 'liters',
  'meat': 'kg',
  'vegetables': 'kg',
  'fruits': 'kg',
  'baked goods': 'pieces',
  
  // Supplies & Equipment
  'supplies': 'boxes',
  'cleaning': 'bottles',
  'paper products': 'rolls',
  'linens': 'pieces',
  'equipment': 'pieces',
  'utensils': 'pieces',
  'glassware': 'pieces',
};

const ITEM_TYPE_UNIT_MAP: Record<string, string> = {
  'drink': 'bottles',
  'supply': 'boxes',
  'equipment': 'pieces',
  'linens': 'pieces',
  'food': 'servings',
  'ingredient': 'units',
};

/**
 * Get the display unit for an inventory item
 * @param category - Item category (e.g., "drinks", "food")
 * @param itemType - Item type (e.g., "drink", "supply")
 * @returns Display unit string (e.g., "bottles", "pieces", "kg")
 */
export function getDisplayUnit(category?: string, itemType?: string): string {
  if (itemType && ITEM_TYPE_UNIT_MAP[itemType.toLowerCase()]) {
    return ITEM_TYPE_UNIT_MAP[itemType.toLowerCase()];
  }
  
  if (category && CATEGORY_UNIT_MAP[category.toLowerCase()]) {
    return CATEGORY_UNIT_MAP[category.toLowerCase()];
  }
  
  return 'units'; // fallback
}

/**
 * Format quantity with unit for display
 * @param quantity - Numeric quantity
 * @param unit - Unit string (e.g., "bottles", "pieces")
 * @returns Formatted string (e.g., "5 bottles")
 */
export function formatQuantityWithUnit(quantity: number, unit: string): string {
  if (quantity === 1 && unit.endsWith('s')) {
    // Remove trailing 's' for singular
    return `${quantity} ${unit.slice(0, -1)}`;
  }
  return `${quantity} ${unit}`;
}
