# Extras + Inventory Integration - Implementation Guide

## Overview
Extras are now fully integrated with inventory items. They can be:
- Displayed together in a combined inventory table
- Transferred between sections like inventory items
- Added to POS orders
- Marked with visual badges to distinguish them

## Key Changes

### 1. New API Endpoints

#### `GET /api/departments/[code]/items`
Fetches both inventory items AND extras for a department/section combined.
- Returns items with `itemType: 'inventory' | 'extra'`
- Used for display and inventory management
- Includes quantity, available, price (for extras)

**Response Format:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "item_id",
        "name": "Item Name",
        "itemType": "inventory",
        "quantity": 10,
        "available": 8,
        "sku": "SKU-001",
        "category": "food"
      },
      {
        "id": "extra_id",
        "name": "Extra Sauce (Extra)",
        "itemType": "extra",
        "quantity": 5,
        "available": 5,
        "unit": "portion",
        "price": 100,
        "category": "extra"
      }
    ]
  }
}
```

#### `POST /api/departments/[code]/items/transfer`
Transfer items (inventory or extras) between sections.
- Handles both inventory and extras transfers
- Reduces from source, adds to destination
- Creates destination if it doesn't exist

**Request Body:**
```json
{
  "itemId": "item_or_extra_id",
  "itemType": "inventory|extra",
  "sourceSectionId": null,        // null = parent level
  "destinationSectionId": "sec123",
  "quantity": 5
}
```

#### `GET /api/departments/[code]/pos/items`
Fetches active extras + inventory for POS menu display.
- Filters by sectionId if provided
- Filters by category if provided
- Only returns active extras

### 2. New Components

#### `DepartmentItemsTable`
Displays inventory + extras in a combined table with:
- Visual badges marking extras and tracked items
- Quick actions: Transfer, Convert to Extra
- Stock levels with warnings for low quantities
- Proper formatting for extras (unit instead of SKU)

**Usage:**
```tsx
<DepartmentItemsTable
  departmentCode="RESTAURANT"
  sectionId={sectionId}
  onTransfer={handleTransfer}
  onConvertToExtra={handleConvert}
/>
```

### 3. Service Layer Enhancement

#### `DepartmentExtrasService.transferExtra()`
NEW method to transfer extras between sections, matching the inventory transfer pattern:
```typescript
await DepartmentExtrasService.transferExtra(
  departmentId,
  extraId,
  sourceSectionId,    // null = parent
  destinationSectionId,
  quantity
);
```

### 4. Data Flow

#### Adding Extras to Orders
1. User selects "Add Item" in POS
2. System fetches from `/api/departments/[code]/pos/items`
3. List includes both inventory + active extras
4. Extras have `itemType: 'extra'` to distinguish in UI
5. When adding to order:
   - For inventory: deduct from `DepartmentInventory`
   - For extras: deduct from `DepartmentExtra` AND sync to `DepartmentInventory` if `trackInventory=true`

#### Transferring Extras
1. User selects "Transfer" on extra in inventory table
2. System calls `/api/departments/[code]/items/transfer`
3. Service handles both inventory and extras uniformly
4. Stock synchronized across sections

## UI Integration Points

### Inventory Management Page
Replace generic inventory view with `DepartmentItemsTable` to show:
- All department inventory items
- All allocated extras for that department
- Transfer capabilities for both types

### POS Menu
Update POS product grid to:
- Fetch from `/api/departments/[code]/pos/items` instead of separate endpoints
- Display extras in category "Extra" or inline
- Use `itemType` to handle differently when adding to cart

### Order Detail Page
When adding extras to existing order:
1. Show "Add Extra" button alongside "Add Item"
2. Fetch available extras from `/api/departments/[code]/pos/items?itemType=extra`
3. Allow selecting quantity, then add to order line
4. Sync inventory if `trackInventory=true`

## Migration Path

### For Existing Extras
- All existing extras are already in `DepartmentExtra` table
- If they have `trackInventory=true` and `productId` set, they sync automatically
- New combined view shows them alongside inventory items

### For New Extras
- Created via "Create New" mode: standalone, no tracking
- Converted via "From Inventory" mode: tracked, links to inventory item
- Both appear in combined inventory view

## Testing Checklist

- [ ] Fetch combined items via `/api/departments/[code]/items`
- [ ] Transfer inventory item between sections
- [ ] Transfer extra between sections
- [ ] Add extra to POS order
- [ ] Add extra to existing order
- [ ] Verify inventory syncs when extra used (if tracked)
- [ ] Verify UI shows correct badges for extras
- [ ] Test low stock warnings work for both types
- [ ] Test transfer reduces source and increases destination

## Performance Considerations

- Both endpoints paginate with `limit=999` by default (suitable for restaurant operations)
- Use database indexes on `departmentId`, `sectionId`, `extraId` for fast lookups
- Consider caching department items in POS for fast menu loading

## Future Enhancements

1. **Combo Items**: Bundles of inventory + extras
2. **Recipe Modifiers**: Extras that modify inventory quantities
3. **Batch Operations**: Transfer multiple items at once
4. **Inventory Forecasting**: Predict extra usage based on patterns
5. **Stock Alerts**: Notify when extras reach low levels
