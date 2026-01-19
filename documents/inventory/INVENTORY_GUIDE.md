# Inventory Management System

## Overview

The Inventory Management System provides comprehensive inventory tracking for multiple item types including drinks, supplies, equipment, linens, and more. It supports inventory movements tracking, low stock alerts, expiry management, and detailed statistics.

## Schema Models

### InventoryType
Defines categories of inventory items.

```
- id: string (primary key)
- typeName: string (unique)
- description: string (optional)
- category: string (e.g., "drinks", "supplies", "equipment", "linens")
- inventoryItems: InventoryItem[] (relation)
```

### InventoryItem
Individual inventory items with stock tracking.

```
- id: string (primary key)
- name: string
- description: string (optional)
- sku: string (unique)
- category: string
- itemType: string (e.g., drink, supply, equipment, linens)
- quantity: int (current stock)
- reorderLevel: int (threshold for reordering)
- maxQuantity: int (optional, maximum stock capacity)
- unitPrice: Decimal
- location: string (storage location)
- supplier: string (optional)
- lastRestocked: DateTime (optional)
- expiry: DateTime (optional)
- inventoryTypeId: string (foreign key)
- movements: InventoryMovement[] (relation)
```

### InventoryMovement
Tracks all inventory changes (in, out, adjustments, losses).

```
- id: string (primary key)
- movementType: string ("in", "out", "adjustment", "loss")
- quantity: int
- reason: string (optional)
- reference: string (optional - booking ID, order ID, etc.)
- inventoryItemId: string (foreign key)
```

## API Endpoints

### 1. Inventory Items

#### GET /api/inventory
Fetch all inventory items with filtering and pagination.

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 10)
- `inventoryTypeId`: string (filter by type)
- `category`: string (filter by category - drinks, supplies, equipment, linens)
- `itemType`: string (filter by item type)
- `location`: string (filter by storage location)
- `search`: string (search by name or SKU)
- `lowStock`: boolean (show only low stock items)
- `expired`: boolean (show only expired items)

**Example:**
```bash
GET /api/inventory?category=drinks&lowStock=true&limit=20
GET /api/inventory?search=vodka
GET /api/inventory?location=Bar%20Storage
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "meta": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "pages": 5
    }
  },
  "message": "Inventory items fetched successfully"
}
```

#### POST /api/inventory
Create a new inventory item.

**Request Body:**
```json
{
  "name": "Premium Vodka",
  "sku": "VOD-001",
  "category": "drinks",
  "itemType": "drink",
  "quantity": 50,
  "reorderLevel": 10,
  "maxQuantity": 100,
  "unitPrice": "25.99",
  "location": "Bar Storage",
  "supplier": "Supplier Co",
  "inventoryTypeId": "type-id-123",
  "expiry": "2025-12-31T00:00:00Z"
}
```

#### GET /api/inventory/[id]
Get specific inventory item details.

**Query Parameters:**
- `includeMovements`: boolean (include movement history)

**Example:**
```bash
GET /api/inventory/item-123?includeMovements=true
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "item-123",
    "name": "Premium Vodka",
    "sku": "VOD-001",
    "quantity": 45,
    "reorderLevel": 10,
    "unitPrice": "25.99",
    "movements": [
      {
        "id": "mov-1",
        "movementType": "out",
        "quantity": 5,
        "reason": "Used for bar service",
        "reference": "booking-456",
        "createdAt": "2025-11-14T10:30:00Z"
      }
    ]
  }
}
```

#### PUT /api/inventory/[id]
Update an inventory item.

**Request Body:**
```json
{
  "quantity": 55,
  "reorderLevel": 15,
  "location": "New Storage Area"
}
```

#### DELETE /api/inventory/[id]
Delete an inventory item.

---

### 2. Inventory Types

#### GET /api/inventory/types
Get all inventory types with optional filtering.

**Query Parameters:**
- `category`: string (filter by category)

**Example:**
```bash
GET /api/inventory/types
GET /api/inventory/types?category=drinks
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "type-1",
        "typeName": "Spirits",
        "category": "drinks",
        "description": "Alcoholic beverages - spirits"
      }
    ],
    "meta": {
      "total": 1
    }
  }
}
```

#### POST /api/inventory/types
Create a new inventory type.

**Request Body:**
```json
{
  "typeName": "Spirits",
  "category": "drinks",
  "description": "Alcoholic beverages - spirits"
}
```

---

### 3. Inventory Operations

#### GET /api/inventory/operations
Perform special inventory operations.

**Query Parameters:**
- `op`: string (operation type - "stats", "low-stock", "expired", "needs-restock")

**Examples:**

**Get Inventory Statistics:**
```bash
GET /api/inventory/operations?op=stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalItems": 150,
    "categories": 5,
    "types": 12,
    "lowStockCount": 8,
    "expiredCount": 2,
    "totalValue": "15750.50"
  }
}
```

**Get Low Stock Items:**
```bash
GET /api/inventory/operations?op=low-stock
```

**Get Expired Items:**
```bash
GET /api/inventory/operations?op=expired
```

**Get Items Needing Restock:**
```bash
GET /api/inventory/operations?op=needs-restock
```

#### POST /api/inventory/operations
Adjust inventory quantity.

**Query Parameters:**
- `op`: "adjust" (required)

**Request Body:**
```json
{
  "itemId": "item-123",
  "delta": -5,
  "reason": "Bar consumption",
  "reference": "booking-456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "item-123",
    "name": "Premium Vodka",
    "quantity": 40,
    "lastRestocked": "2025-11-14T10:30:00Z"
  }
}
```

---

### 4. Inventory Movements

#### GET /api/inventory/movements
Get inventory movements/history with filtering.

**Query Parameters:**
- `itemId`: string (filter by item)
- `type`: string ("in", "out", "adjustment", "loss")
- `startDate`: ISO date string
- `endDate`: ISO date string
- `page`: number (default: 1)
- `limit`: number (default: 20)

**Examples:**
```bash
GET /api/inventory/movements?itemId=item-123
GET /api/inventory/movements?type=out&startDate=2025-11-01T00:00:00Z&endDate=2025-11-30T23:59:59Z
GET /api/inventory/movements?type=in&page=1&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "mov-1",
        "movementType": "out",
        "quantity": 5,
        "reason": "Bar consumption",
        "reference": "booking-456",
        "inventoryItemId": "item-123",
        "createdAt": "2025-11-14T10:30:00Z"
      }
    ],
    "meta": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "pages": 3
    }
  }
}
```

#### POST /api/inventory/movements
Record a new inventory movement.

**Request Body:**
```json
{
  "itemId": "item-123",
  "movementType": "in",
  "quantity": 20,
  "reason": "Restocking delivery",
  "reference": "supplier-order-789"
}
```

---

## Service Methods

### InventoryItemService

```typescript
// Get all items with optional filters
getAllItems(filters?: {
  inventoryTypeId?: string;
  category?: string;
  itemType?: string;
  location?: string;
}): Promise<IInventoryItem[]>

// Get items by type
getByType(inventoryTypeId: string): Promise<IInventoryItem[]>

// Get items by category
getByCategory(category: string): Promise<IInventoryItem[]>

// Get low stock items
getLowStockItems(): Promise<IInventoryItem[]>

// Get items needing restock
getItemsNeedingRestock(): Promise<IInventoryItem[]>

// Get expired items
getExpiredItems(): Promise<IInventoryItem[]>

// Update quantity
updateQuantity(itemId: string, quantity: number): Promise<IInventoryItem | null>

// Adjust quantity (by delta)
adjustQuantity(itemId: string, delta: number, reason?: string): Promise<IInventoryItem | null>

// Get inventory statistics
getInventoryStats(): Promise<InventoryStats | null>

// Search items
search(query: string): Promise<IInventoryItem[]>
```

### InventoryMovementService

```typescript
// Get movements for an item
getByItem(itemId: string): Promise<IInventoryMovement[]>

// Get movements within date range
getByDateRange(startDate: Date, endDate: Date): Promise<IInventoryMovement[]>

// Get movements by type
getByType(movementType: 'in' | 'out' | 'adjustment' | 'loss'): Promise<IInventoryMovement[]>

// Record a movement
recordMovement(
  itemId: string,
  movementType: 'in' | 'out' | 'adjustment' | 'loss',
  quantity: number,
  reason?: string,
  reference?: string
): Promise<IInventoryMovement | null>
```

---

## Usage Examples

### Example 1: Add New Drink Type

```bash
curl -X POST http://localhost:3000/api/inventory/types \
  -H "Content-Type: application/json" \
  -d '{
    "typeName": "Whiskey",
    "category": "drinks",
    "description": "Premium whiskey selection"
  }'
```

### Example 2: Create Inventory Item

```bash
curl -X POST http://localhost:3000/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Single Malt Scotch",
    "sku": "WHIS-001",
    "category": "drinks",
    "itemType": "drink",
    "quantity": 30,
    "reorderLevel": 5,
    "unitPrice": "45.50",
    "location": "Premium Bar",
    "inventoryTypeId": "type-whiskey",
    "supplier": "Scottish Imports Ltd"
  }'
```

### Example 3: Monitor Low Stock

```bash
curl http://localhost:3000/api/inventory/operations?op=low-stock
```

### Example 4: Adjust Stock After Service

```bash
curl -X POST http://localhost:3000/api/inventory/operations?op=adjust \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "item-123",
    "delta": -3,
    "reason": "Served to guests",
    "reference": "booking-456"
  }'
```

### Example 5: Record Restocking

```bash
curl -X POST http://localhost:3000/api/inventory/movements \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "item-123",
    "movementType": "in",
    "quantity": 50,
    "reason": "Delivery from supplier",
    "reference": "PO-2025-11-001"
  }'
```

---

## Item Categories

Predefined categories for inventory items:

- **drinks**: Beverages (alcoholic and non-alcoholic)
- **supplies**: General supplies and consumables
- **equipment**: Bar equipment, kitchen equipment
- **linens**: Bed linens, towels, table cloths
- **amenities**: Room amenities and toiletries

---

## Movement Types

Track inventory changes with these movement types:

- **in**: Stock received (restocking, returns)
- **out**: Stock used/sold (consumption, sales)
- **adjustment**: Manual corrections
- **loss**: Damaged, expired, or lost items

---

## Best Practices

1. **Set Reorder Levels**: Always set appropriate reorder levels for each item to prevent stockouts.

2. **Regular Audits**: Use the statistics endpoint (`/api/inventory/operations?op=stats`) to monitor overall inventory health.

3. **Track References**: Always include reference IDs (booking IDs, order IDs) when recording movements for audit trails.

4. **Monitor Expiry**: Regularly check expired items (`/api/inventory/operations?op=expired`) to prevent spoilage.

5. **Location Management**: Use consistent location naming to track where items are stored.

6. **Supplier Tracking**: Maintain supplier information for easy reordering.

---

## Integration with Bookings

Connect inventory movements to bookings for automatic tracking:

```typescript
// Example: When a drink is served
await inventoryItemService.adjustQuantity(
  drinkId,
  -quantity,
  `Served to guest`,
  bookingId // reference
);
```

---

## Future Enhancements

- [ ] Barcode/QR code scanning
- [ ] Automated reorder alerts
- [ ] Supplier integrations
- [ ] Inventory forecasting
- [ ] Batch operations
- [ ] CSV import/export
- [ ] Real-time low stock notifications
- [ ] Inventory valuation reports
