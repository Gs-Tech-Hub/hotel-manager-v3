# Inventory-to-Extras Conversion Feature

## Overview

Extras can now be created in two ways:
1. **Standalone Extras** - Without inventory tracking (e.g., sauces, garnishes)
2. **Inventory-Backed Extras** - With automatic stock tracking (e.g., converting items like "Extra Portion" or "Premium Side")

The workflow follows the same pattern as inventory management:
- **Create/Mark at Global Level** - Global registry of extras
- **Allocate to Department** - Department gets a quantity allocation
- **Transfer to Sections** - Departments distribute to their sections

## How It Works

### Standalone Extra (No Inventory Tracking)

**Use Case:** Items that don't need stock management (e.g., "Extra Sauce", "Extra Topping")

**Workflow:**
1. Select "Create New" mode in Extras Form
2. Fill in: Name, Unit (portion/container/etc), Price
3. Select Department
4. Click Create
5. Quantity managed manually or via transfer between sections

**API Flow:**
```
POST /api/extras
├─ Create extra at global level (no inventory link)
└─ Response: Extra record with isActive=true, trackInventory=false

POST /api/departments/[code]/extras
├─ Allocate extra to department
└─ Creates DepartmentExtra record with quantity=0
```

### Inventory-Backed Extra (With Stock Tracking)

**Use Case:** Converting inventory items to extras with automatic stock synchronization (e.g., "Extra Portion of Steak", "Premium Beverage")

**Workflow:**
1. Select "From Inventory" mode in Extras Form
2. Select Department (system filters to show only unallocated inventory items)
3. Select Inventory Item to convert
4. Review summary (shows current stock and what will happen)
5. Click Convert & Allocate
6. Extra is created globally with `trackInventory=true` and `productId` reference
7. Extra is allocated to department with current inventory quantity
8. Inventory is now tracked as an extra

**Data Flow:**
```
Step 1: Create Extra from Inventory Item
POST /api/extras/from-product
├─ Input: productId, unit, priceOverride, trackInventory=true
├─ Creates Extra with:
│  ├─ productId → Links to InventoryItem
│  ├─ trackInventory = true
│  └─ price = (priceOverride OR inventoryItem.unitPrice)
└─ Response: Extra record

Step 2: Allocate to Department
POST /api/departments/[code]/extras
├─ Input: extraId, quantity (synced from DepartmentInventory)
└─ Creates DepartmentExtra with current inventory quantity

Result: Inventory now tracked via DepartmentExtra
```

## Key Features

### 1. Department Inventory Filtering
- **Endpoint:** `GET /api/departments/[code]/inventory-for-extras`
- **Returns:** Only inventory items in that department that aren't already converted to extras
- **Prevents:** Double-conversion (same item can't be converted twice to different extras in same dept)
- **Includes:** Current quantity, available (reserved) quantity, SKU, category

### 2. Stock Synchronization
When an inventory item is converted to an extra:
- Current quantity from `DepartmentInventory` syncs to `DepartmentExtra`
- Subsequent stock changes tracked in `DepartmentExtra` (similar to inventory)
- Price defaults to inventory item's unitPrice (can be overridden)

### 3. Workflow Pattern Consistency
```
Regular Inventory:
InventoryItem (global) → DepartmentInventory → DepartmentSection (transfer)

Extras from Inventory:
Extra (global, linked to InventoryItem) → DepartmentExtra → Section (transfer)
```

### 4. Clear User Interface
- Mode selector with helpful context
- Visual summary of what conversion does
- Filtered inventory list (prevents selection of already-converted items)
- Department and section selection with optional scoping

## API Endpoints

### Fetch Department Inventory for Extras Conversion
```
GET /api/departments/[code]/inventory-for-extras?search=sauce&page=1&limit=20

Response:
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "inv_123",
        "name": "Extra Sauce",
        "sku": "SAUCE-001",
        "description": "Premium sauce",
        "unitPrice": 2.50,
        "category": "supplies",
        "quantity": 50,
        "reserved": 5,
        "available": 45
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "pages": 1,
      "departmentId": "dept_123",
      "departmentName": "Kitchen"
    }
  }
}
```

### Create Extra from Inventory Item
```
POST /api/extras/from-product
{
  "productId": "inv_123",
  "unit": "portion",
  "priceOverride": 2.50,
  "trackInventory": true
}

Response:
{
  "success": true,
  "data": {
    "extra": {
      "id": "extra_456",
      "name": "Extra Sauce",
      "unit": "portion",
      "price": 250,  // in cents
      "productId": "inv_123",
      "trackInventory": true,
      "isActive": true
    }
  }
}
```

### Allocate Extra to Department
```
POST /api/departments/[code]/extras
{
  "extraId": "extra_456",
  "quantity": 45,  // synced from inventory
  "sectionId": null  // optional: allocate to specific section
}

Response:
{
  "success": true,
  "data": {
    "extra": {
      "id": "deptext_789",
      "departmentId": "dept_123",
      "extraId": "extra_456",
      "quantity": 45,
      "reserved": 0
    }
  }
}
```

## Service Methods

### DepartmentExtrasService

#### Allocate Inventory Item as Extra
```typescript
static async allocateInventoryItemAsExtra(
  departmentId: string,
  inventoryItemId: string,
  unit: string,
  priceOverride?: number,
  sectionId?: string | null
): Promise<DepartmentExtra>
```

**Features:**
- One atomic operation to convert and allocate
- Validates inventory item exists and isn't already converted
- Syncs current quantity from DepartmentInventory
- Returns allocation ready for section transfers

**Example:**
```typescript
const allocation = await DepartmentExtrasService.allocateInventoryItemAsExtra(
  departmentId,
  'inv_sauce_123',
  'portion',
  250,  // price in cents, optional
  null  // department-level, not scoped to section
);
```

### ExtrasService

#### Create Extra from Product
```typescript
async createExtraFromProduct(data: {
  productId: string;
  unit: string;
  priceOverride?: number;
  trackInventory?: boolean;
}): Promise<Extra>
```

## UI Workflow

### Create New Extra
1. Open Extras Form Dialog
2. Click "Create New" button
3. Fill form:
   - Name (required)
   - Description (optional)
   - Unit (required) - e.g., "portion", "container"
   - Price (required) - in currency
4. Select Department (required)
5. Optionally select Section for section-scoped extra
6. Click "Create" button

### Convert Inventory to Extra
1. Open Extras Form Dialog
2. Click "From Inventory" button
3. See helpful info: "1️⃣ Select department → 2️⃣ Select inventory item → ✅ Convert & Allocate"
4. Select Department (filters available items)
5. Select Inventory Item from dropdown (shows SKU and stock)
6. Review conversion summary box showing:
   - Item name and SKU
   - Current stock allocation
   - What will happen (stock sync, inventory tracking enabled)
7. Optionally override price (defaults to inventory item price)
8. Click "Convert & Allocate" button
9. System creates extra, allocates to department, updates status

## Data Consistency

### Validation Checks
- ✅ Cannot convert same inventory item twice in same department
- ✅ Inventory item must be active and exist
- ✅ Department must exist and be active
- ✅ Price validation (positive, normalized to cents)

### Synchronization
- When extra added to order line, can deduct from DepartmentExtra
- DepartmentExtra.quantity tracked same as DepartmentInventory
- Reserved quantity managed for pending orders
- Reconciliation available via `DepartmentExtrasService.reconcileDepartmentExtras()`

### Transfer Between Sections
```typescript
// Transfer extra units from one section to another
await DepartmentExtrasService.transferExtrasBetweenSections(
  departmentId,
  extraId,
  sourceSectionId,
  destinationSectionId,
  quantity
);
```

## Benefits

1. **Unified Tracking** - Inventory items can be managed as extras without separate tracking
2. **Stock Sync** - Automatic synchronization between DepartmentInventory and DepartmentExtra
3. **Flexible** - Mix standalone extras (no tracking) with inventory-backed extras (with tracking)
4. **Consistent Pattern** - Same workflow as inventory: global → department → section
5. **Clear UI** - Visual guidance and confirmation of what conversion does
6. **Atomic Operations** - Single endpoint for convert+allocate reduces errors

## Example Scenarios

### Scenario 1: Sauce as Standalone Extra
```
Menu: Add "Extra BBQ Sauce" (+$0.50)
- Create New Extra
- Name: "Extra BBQ Sauce"
- Unit: "container"
- Price: $0.50
- Allocate to Kitchen department
- Manually manage quantity or track via transfers only
```

### Scenario 2: Premium Protein as Inventory-Backed Extra
```
Menu: Add "Extra Steak Portion" (+$8.00)
- From Inventory: Select "Premium Steak Cut" (100 portions in stock)
- Unit: "portion"
- Price: $8.00 (auto-filled from inventory)
- Convert & Allocate
- Result: 100 portions allocated to Kitchen, inventory auto-tracked
- When ordered: Deduct from DepartmentExtra.quantity
```

### Scenario 3: Specialty Beverage (Section-Specific)
```
Menu: Add "Premium Champagne" (+$15.00) - Bar only
- From Inventory: Select "Champagne Bottle" (40 bottles in bar inventory)
- Unit: "bottle"
- Price: $15.00
- Select Bar section in allocation
- Result: 40 bottles allocated to Bar section specifically
- Available only in bar orders
```

## Migration Path (If Existing Extras)

For restaurants with existing extras:

1. **Identify candidates** - Which extras should track inventory?
2. **Create inventory items** (if not existing) - Add new items or rename existing
3. **Convert via UI** - Use "From Inventory" mode for each candidate
4. **Test** - Verify order deductions and quantity tracking
5. **Deprecate** - Disable standalone extra if inventory version works

## Troubleshooting

### Issue: "No inventory items found for this department"
**Solution:** 
- Check if department has active inventory items allocated
- Verify inventory items are not already converted to extras in this department
- Use regular inventory management to add items first

### Issue: Converted extra shows wrong price
**Solution:**
- Edit extra after conversion to update price
- Or use "priceOverride" parameter when converting

### Issue: Stock not syncing after conversion
**Solution:**
- Stock syncs at conversion time only
- New inventory added after conversion won't auto-appear in DepartmentExtra
- Manually adjust DepartmentExtra quantity or use transfer API

## Future Enhancements

1. **Bulk conversion** - Convert multiple inventory items to extras at once
2. **Auto-sync** - Periodic sync between InventoryItem and Extra quantities
3. **Image linking** - Show product images for visual extras
4. **Alerts** - Low stock alerts for tracked extras
5. **Analytics** - Most popular converted extras per department
