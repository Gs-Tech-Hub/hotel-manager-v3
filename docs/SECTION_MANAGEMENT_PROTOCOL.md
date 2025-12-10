# Section Management Protocol

## Overview

Sections are independent sub-units within departments with their own inventory tracking, orders tracking, and audit trails. This document defines the unified protocol for section management across all departments.

## Architecture

### Data Model

```
Department
├── DepartmentSection (1:n)
│   ├── metadata: JSON (section-specific config)
│   ├── DepartmentInventory (1:n) - section-scoped inventory
│   │   └── InventoryItem (1:1) - links to actual items
│   └── OrderLine (via departmentCode filter)
│       └── Tracks orders for this section
```

### Key Principles

1. **Independent Tracking**: Each section has its own inventory records in `DepartmentInventory` with `sectionId`
2. **Consistent Routing**: All operations (transfers, stock takes, orders) must specify section code
3. **Audit Trail**: All changes are logged via `InventoryMovement` and transfer records
4. **Parent Aggregation**: Parent department totals aggregate section stats (optional for display)

## Section Codes

All section references use the format: `PARENT_CODE:section-slug`

Examples:
- `RESTAURANT:main` - Main dining area of restaurant
- `RESTAURANT:bar` - Bar section of restaurant
- `HOTEL:spa` - Spa section
- `BAR:vip` - VIP lounge

## API Endpoints

### 1. Section Inventory Management

#### GET /api/departments/[code]/section/inventory
Get all inventory items for a section with current quantities.

**Example:**
```bash
GET /api/departments/RESTAURANT:main/section/inventory
```

**Response:**
```json
{
  "success": true,
  "data": {
    "section": {
      "id": "section-123",
      "code": "RESTAURANT:main",
      "name": "Main Dining Area"
    },
    "inventories": [
      {
        "id": "dinv-456",
        "itemId": "item-789",
        "itemName": "Premium Vodka",
        "itemSku": "VOD-001",
        "quantity": 50,
        "reserved": 5,
        "available": 45,
        "unitPrice": 2500,
        "category": "drinks"
      }
    ]
  }
}
```

#### GET /api/departments/[code]/section/inventory?op=summary
Get section stock summary with counts by status.

**Response:**
```json
{
  "success": true,
  "data": {
    "section": {
      "code": "RESTAURANT:main",
      "name": "Main Dining Area"
    },
    "summary": {
      "available": 15,
      "lowStock": 3,
      "outOfStock": 2,
      "totalItems": 20,
      "totalValue": 125000,
      "totalQuantity": 150
    }
  }
}
```

#### GET /api/departments/[code]/section/inventory?op=audit
Get incoming/outgoing transfer audit trail for a section.

**Query Parameters:**
- `itemId`: Filter by item
- `movementType`: in | out | adjustment | loss
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "section": {
      "code": "RESTAURANT:main",
      "id": "section-123"
    },
    "incomingTransfers": [
      {
        "id": "transfer-001",
        "fromDepartment": "WAREHOUSE",
        "fromCode": "WAREHOUSE",
        "items": [
          {
            "productId": "item-789",
            "productType": "inventoryItem",
            "quantity": 20
          }
        ],
        "status": "completed",
        "createdAt": "2025-12-09T10:00:00Z",
        "completedAt": "2025-12-09T10:05:00Z"
      }
    ],
    "total": 1
  }
}
```

#### POST /api/departments/[code]/section/inventory?op=adjust
Manually adjust section inventory (stock take, damage, etc.).

**Body:**
```json
{
  "itemId": "item-789",
  "delta": -5,
  "reason": "stock-take-loss",
  "reference": "count-2025-12"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Adjusted Premium Vodka by -5 units in section RESTAURANT:main",
  "data": {
    "id": "dinv-456",
    "quantity": 45,
    "departmentId": "dept-123",
    "sectionId": "section-456"
  }
}
```

### 2. Inventory Transfers to Sections

#### POST /api/departments/[code]/transfer
Transfer inventory to a section.

**Body:**
```json
{
  "toDepartmentCode": "RESTAURANT:main",
  "items": [
    {
      "type": "inventoryItem",
      "id": "item-789",
      "quantity": 20
    }
  ]
}
```

**Flow:**
1. Transfer route detects destination is section (contains `:`)
2. Looks up section in `DepartmentSection` table
3. Creates transfer with `toDepartmentId = parent.id` and stores section code in notes
4. Transfer service reads section info from notes
5. Creates/updates `DepartmentInventory` records with `sectionId` set to destination section
6. Stock is recorded as incoming to the section for audit purposes

### 3. Section Stock Display

#### GET /api/departments/[code]/stock
Get section stock summary (existing endpoint).

**Note:** This now queries section-specific inventory if code is a section code.

## Inventory Tracking Strategy

### For Inventory Items (Generic Supplies)
- Tracked in `DepartmentInventory` table
- When transfer destination is section: `DepartmentInventory.sectionId` is set to section ID
- Stock is isolated per section
- Parent department query must aggregate if needed

### For Drinks/Food
- **Primary source**: `Drink.barStock` / `Drink.quantity` or `FoodItem.availability`
- **Fallback**: `DepartmentInventory` when applicable
- Sections share parent's drinks/food (same bar, just different sections)
- Stock updates go to parent, sections identified by `departmentCode` in orders

### Example: Bar with Sections

```
Bar (HOTEL_BAR)
├── VIP Section (HOTEL_BAR:vip)
│   ├── Drinks: shared from parent bar
│   ├── Generic Supplies: own inventory (sectionId set)
│   └── Orders: tracked by departmentCode = "HOTEL_BAR:vip"
├── Main Section (HOTEL_BAR:main)
│   ├── Drinks: shared from parent bar
│   ├── Generic Supplies: own inventory
│   └── Orders: tracked by departmentCode = "HOTEL_BAR:main"
```

## Stock Audit Process

### For Inventory Items in Sections
1. **Transfers In**: Creates transfer with destination section code
2. **Transfer Approval**: Creates/updates `DepartmentInventory` with `sectionId`
3. **Manual Adjustments**: Use `/api/departments/[code]/section/inventory?op=adjust`
4. **Audit Query**: `/api/departments/[code]/section/inventory?op=audit` shows transfer history

### For Drinks in Sections
1. **Transfers**: Update parent bar's `Drink.barStock` / `quantity`
2. **Orders**: Tracked via `OrderLine.departmentCode` filter
3. **Audit**: Need to cross-reference orders by `departmentCode` + inventory changes

## Implementation Checklist

- [x] Add `sectionId` to `DepartmentInventory` schema
- [x] Add inverse relation `DepartmentSection.inventories`
- [x] Update transfer service to set `sectionId` on destination
- [x] Create `SectionInventoryService` for queries/audits
- [x] Create `/api/departments/[code]/section/inventory` endpoints
- [ ] Update section stock display to use section-specific inventory
- [ ] Create migration for existing data (if any)
- [ ] Add section inventory UI widgets
- [ ] Add audit trail viewer

## Migration Guide

For existing data:
1. Sections created before this protocol default to parent-level inventory
2. To enable independent tracking: run data migration to create section-scoped `DepartmentInventory` records
3. Future transfers to sections automatically use section-scoped inventory

## Examples

### Transfer from Warehouse to Restaurant Section

```bash
# Create transfer
curl -X POST http://localhost:3000/api/departments/WAREHOUSE/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "toDepartmentCode": "RESTAURANT:main",
    "items": [
      {"type": "inventoryItem", "id": "vodka-001", "quantity": 20}
    ]
  }'

# Check incoming transfer (audit trail)
curl "http://localhost:3000/api/departments/RESTAURANT:main/section/inventory?op=audit"

# Adjust for damage/loss
curl -X POST "http://localhost:3000/api/departments/RESTAURANT:main/section/inventory?op=adjust" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "vodka-001",
    "delta": -2,
    "reason": "bottle-broken"
  }'

# View section stock summary
curl "http://localhost:3000/api/departments/RESTAURANT:main/section/inventory?op=summary"
```

## Key Differences from Parent Inventory

| Aspect | Parent Dept | Section |
|--------|-----------|---------|
| Inventory Records | `DepartmentInventory.sectionId = null` | `DepartmentInventory.sectionId = section.id` |
| Scope | All sections aggregated | Single section only |
| Orders | Via parent code | Via section code (departmentCode) |
| Transfers | To parent | To section (stored in notes) |
| Stock Display | Parent total | Section specific |
| Audit | Department-wide | Section-specific |

