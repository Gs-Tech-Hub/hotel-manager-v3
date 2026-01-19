# Inventory System - Quick Reference

## 🚀 Quick Start

### 1. Create an Inventory Type
```bash
curl -X POST http://localhost:3000/api/inventory/types \
  -H "Content-Type: application/json" \
  -d '{"typeName":"Spirits","category":"drinks"}'
```

### 2. Create an Inventory Item
```bash
curl -X POST http://localhost:3000/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Vodka Premium",
    "sku":"VOD-001",
    "category":"drinks",
    "quantity":50,
    "reorderLevel":10,
    "unitPrice":"25.99",
    "inventoryTypeId":"TYPE_ID_HERE"
  }'
```

### 3. Check Low Stock
```bash
curl "http://localhost:3000/api/inventory/operations?op=low-stock"
```

### 4. Adjust Stock
```bash
curl -X POST "http://localhost:3000/api/inventory/operations?op=adjust" \
  -H "Content-Type: application/json" \
  -d '{"itemId":"ITEM_ID","delta":-5,"reason":"Bar service"}'
```

---

## 📊 API Endpoints Quick Map

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/inventory` | List all items |
| POST | `/api/inventory` | Create item |
| GET | `/api/inventory/[id]` | Get item details |
| PUT | `/api/inventory/[id]` | Update item |
| DELETE | `/api/inventory/[id]` | Delete item |
| GET | `/api/inventory/types` | List types |
| POST | `/api/inventory/types` | Create type |
| GET | `/api/inventory/operations?op=stats` | Statistics |
| GET | `/api/inventory/operations?op=low-stock` | Low stock items |
| GET | `/api/inventory/operations?op=expired` | Expired items |
| POST | `/api/inventory/operations?op=adjust` | Adjust stock |
| GET | `/api/inventory/movements` | Movement history |
| POST | `/api/inventory/movements` | Record movement |

---

## 🔍 Filtering Examples

### Get Drinks Only
```
GET /api/inventory?category=drinks
```

### Get Items by Supplier
```
GET /api/inventory?search=premium
```

### Get Expired Items
```
GET /api/inventory?expired=true
```

### Get Low Stock (With Pagination)
```
GET /api/inventory?lowStock=true&limit=20&page=1
```

### Search by SKU
```
GET /api/inventory?search=VOD-001
```

---

## 📈 Sample Data Structure

### Inventory Item
```typescript
{
  id: "item-123",
  name: "Premium Vodka",
  sku: "VOD-001",
  category: "drinks",
  itemType: "drink",
  quantity: 45,
  reorderLevel: 10,
  maxQuantity: 100,
  unitPrice: "25.99",
  location: "Bar Storage",
  supplier: "Premium Imports",
  lastRestocked: "2025-11-14T10:00:00Z",
  expiry: "2025-12-31T23:59:59Z",
  inventoryTypeId: "type-123"
}
```

### Inventory Movement
```typescript
{
  id: "mov-456",
  movementType: "out",
  quantity: 5,
  reason: "Bar consumption",
  reference: "booking-789",
  inventoryItemId: "item-123",
  createdAt: "2025-11-14T14:30:00Z"
}
```

---

## 💡 Common Workflows

### Workflow 1: Daily Bar Restocking
```bash
# 1. Check low stock
curl "http://localhost:3000/api/inventory/operations?op=low-stock"

# 2. Receive delivery
curl -X POST "http://localhost:3000/api/inventory/movements" \
  -H "Content-Type: application/json" \
  -d '{"itemId":"VOD-001","movementType":"in","quantity":50,"reason":"Delivery"}'

# 3. Verify updated quantity
curl "http://localhost:3000/api/inventory/item-123?includeMovements=true"
```

### Workflow 2: Track Guest Consumption
```bash
# Record drink served
curl -X POST "http://localhost:3000/api/inventory/operations?op=adjust" \
  -H "Content-Type: application/json" \
  -d '{"itemId":"VOD-001","delta":-1,"reason":"Served","reference":"booking-456"}'
```

### Workflow 3: Inventory Audit
```bash
# Get comprehensive statistics
curl "http://localhost:3000/api/inventory/operations?op=stats"

# Check expired items
curl "http://localhost:3000/api/inventory/operations?op=expired"

# Get movement history for specific item
curl "http://localhost:3000/api/inventory/movements?itemId=VOD-001&limit=50"
```

---

## 🏷️ Predefined Categories

- **drinks** - Beverages (alcoholic/non-alcoholic)
- **supplies** - General supplies and consumables
- **equipment** - Bar/kitchen equipment
- **linens** - Textiles, towels, sheets
- *custom* - Any other category

---

## 📝 Required Fields

### Creating an Item
```
✓ name (string)
✓ sku (string, unique)
✓ category (string)
✓ inventoryTypeId (string)
✓ unitPrice (decimal)
```

### Adjusting Quantity
```
✓ itemId (string)
✓ delta (number - positive or negative)
```

### Recording Movement
```
✓ itemId (string)
✓ movementType (in|out|adjustment|loss)
✓ quantity (number)
```

---

## 🔗 Integration with Bookings

Automatically track consumption:

```typescript
// When a drink is served
await inventoryItemService.adjustQuantity(
  drinkId,
  -quantity,
  "Served to guest",
  bookingId  // Optional reference
);
```

---

## 📊 Statistics Response Format

```json
{
  "totalItems": 150,
  "categories": 5,
  "types": 12,
  "lowStockCount": 8,
  "expiredCount": 2,
  "totalValue": "15750.50"
}
```

---

## ❌ Common Error Codes

| Code | Meaning |
|------|---------|
| 400 | Validation error (missing fields) |
| 404 | Item/type not found |
| 500 | Internal server error |

---

## 📚 Full Documentation

See `INVENTORY_GUIDE.md` for:
- Complete API reference
- Detailed endpoint documentation
- Service method signatures
- Advanced usage examples
- Best practices
- Integration guidelines

---

## 🛠️ TypeScript Usage

```typescript
import { 
  inventoryItemService,
  inventoryTypeService,
  inventoryMovementService 
} from '@/src/services/inventory.service';

// Get all items
const items = await inventoryItemService.getAllItems();

// Get low stock
const lowStock = await inventoryItemService.getLowStockItems();

// Adjust quantity
const updated = await inventoryItemService.adjustQuantity(
  itemId,
  -5,
  "Consumption"
);

// Get stats
const stats = await inventoryItemService.getInventoryStats();
```

---

## 🚀 Performance Tips

1. **Use pagination** - Always paginate large result sets
2. **Filter early** - Use query filters to reduce data
3. **Cache stats** - Statistics can be cached (changes infrequently)
4. **Batch updates** - Group multiple adjustments if possible
5. **Index by SKU** - Search heavily uses SKU

---

## 📞 Support

For issues or questions:
1. Check `INVENTORY_GUIDE.md` for detailed documentation
2. Review `INVENTORY_IMPLEMENTATION.md` for system overview
3. Check error response messages in API responses
