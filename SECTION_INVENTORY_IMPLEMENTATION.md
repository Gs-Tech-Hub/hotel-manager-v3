# Section Management Implementation Summary

## Overview
Implemented a **unified section management protocol** that treats sections as independent entities with their own inventory tracking, order aggregation, and audit trails. This eliminates duplication and provides clear, consistent management across all departments.

## What Was Changed

### 1. Schema (Already in Place)
- ✅ `DepartmentInventory` has optional `sectionId` field
- ✅ `DepartmentSection` has inverse relation `inventories`
- ✅ Unique constraint: `(departmentId, sectionId, inventoryItemId)`

### 2. Transfer Service (`src/services/transfer.service.ts`)

**Updated transfer approval logic:**
- When destination is a section (code contains `:`, e.g., `RESTAURANT:main`):
  - Looks up the section in `DepartmentSection` table
  - Stores parent `referenceType` and `referenceId` on the destination object for proper stock routing
  - Updates inventory with `sectionId` set to the destination section ID
  
- When destination is a parent department:
  - Updates inventory with `sectionId = null` (parent-level inventory)

**Key changes:**
- Lines 169-190: Enhanced section lookup to include `parentDeptId`, `parentDeptId`, `referenceType`, `referenceId`
- Lines 197-207: Updated `destCreates` and `destIncrements` to include optional `sectionId`
- Lines 118-120: Updated `deptInvMap` key building to include `sectionId` 
- Lines 232-242: Updated transaction WHERE clauses to filter by `sectionId` when set

### 3. Section Inventory Service (NEW)
**File:** `src/services/section-inventory.service.ts`

Provides four core operations:
1. **`getSectionInventory(sectionCode)`** - Get all items with quantities for a section
2. **`getSectionInventoryAudit(sectionCode)`** - Get transfer history and incoming stock for section
3. **`getSectionStockSummary(sectionCode)`** - Get summary with counts by status
4. **`adjustSectionInventory(sectionCode, itemId, delta, reason)`** - Manual stock adjustments for stock takes/damage

### 4. Section Inventory API Endpoints (NEW)
**File:** `app/api/departments/[code]/section/inventory/route.ts`

- **GET** `/api/departments/[section-code]/section/inventory` - Get section inventory
- **GET** `/api/departments/[section-code]/section/inventory?op=summary` - Get stock summary
- **GET** `/api/departments/[section-code]/section/inventory?op=audit` - Get transfer audit trail
- **POST** `/api/departments/[section-code]/section/inventory?op=adjust` - Adjust inventory manually

### 5. Section Service (`src/services/section.service.ts`)
**Updated inventory lookup:**
- Now properly resolves section codes (format: `PARENT:slug`) to section IDs
- Queries `DepartmentInventory` with `sectionId` filter when displaying section-specific inventory
- Lines 161-190: Improved section code parsing and database lookup

### 6. Stock API (`app/api/departments/[code]/stock/route.ts`)
**Enhanced to handle sections:**
- Detects if code is a section (contains `:`)
- For sections: Returns summary of section-specific inventory (`DepartmentInventory.sectionId = section.id`)
- For departments: Returns parent-level summary (existing behavior)
- Lines 12-56: Added section detection and section-specific stock query

## Architecture

### Data Flow for Transfers to Sections

```
POST /api/departments/WAREHOUSE/transfer
  ↓
body: { toDepartmentCode: "RESTAURANT:main", items: [...] }
  ↓
Transfer Route (transfer/route.ts)
  ├─ Detects ":main" in destination
  ├─ Looks up RESTAURANT parent dept
  ├─ Looks up "main" section in DepartmentSection table
  ├─ Sets transfer.toDepartmentId = parent.id
  ├─ Stores "RESTAURANT:main" in transfer.notes
  └─ Calls transferService.createTransfer()
  ↓
Transfer Service (transfer.service.ts)
  ├─ Parses destination code from notes
  ├─ Creates section object with parent's referenceType/referenceId
  ├─ For inventory items: Creates/updates DepartmentInventory with sectionId set
  ├─ For drinks: Updates parent drink stock (drinks are shared)
  └─ Marks transfer as completed
  ↓
Stock Audit (via new endpoints)
  ├─ GET /api/departments/RESTAURANT:main/section/inventory?op=audit
  └─ Shows all transfers incoming to this section
```

### Inventory Storage Strategy

```
DepartmentInventory Table
├── Department-level (sectionId = null)
│   └─ Used for parent department totals
│       Example: WAREHOUSE generic supplies
│
└── Section-level (sectionId = section_id)
    └─ Used for section-specific stock
        Example: RESTAURANT:main generic supplies
```

## Key Principles

1. **Independent Tracking**: Sections have separate inventory records from parent
2. **Consistent Routing**: All transfers store full section code for audit trail
3. **Clear Audit**: Incoming transfers show parent → section + audit timestamp
4. **No Duplication**: Section stock is stored once in `DepartmentInventory.sectionId`, not replicated
5. **Shared Drinks**: Bar drinks are shared across sections (same bar, different areas)

## API Usage Examples

### Get Section Inventory
```bash
GET /api/departments/RESTAURANT:main/section/inventory
```

### Get Section Stock Summary
```bash
GET /api/departments/RESTAURANT:main/section/inventory?op=summary
```

### View Incoming Transfers (Audit Trail)
```bash
GET /api/departments/RESTAURANT:main/section/inventory?op=audit
```

### Manual Adjustment (Stock Take Loss)
```bash
POST /api/departments/RESTAURANT:main/section/inventory?op=adjust
Content-Type: application/json

{
  "itemId": "vodka-001",
  "delta": -2,
  "reason": "stock-take-loss",
  "reference": "inventory-2025-12"
}
```

### Transfer to Section
```bash
POST /api/departments/WAREHOUSE/transfer
Content-Type: application/json

{
  "toDepartmentCode": "RESTAURANT:main",
  "items": [
    {"type": "inventoryItem", "id": "vodka-001", "quantity": 20}
  ]
}
```

## Files Modified

| File | Changes |
|------|---------|
| `src/services/transfer.service.ts` | Enhanced section detection, added sectionId to inventory updates |
| `src/services/section.service.ts` | Fixed section code resolution, added sectionId filtering |
| `app/api/departments/[code]/stock/route.ts` | Added section-specific stock query |
| `src/services/section-inventory.service.ts` | NEW - Section inventory queries and audits |
| `app/api/departments/[code]/section/inventory/route.ts` | NEW - Section inventory endpoints |
| `docs/SECTION_MANAGEMENT_PROTOCOL.md` | NEW - Complete protocol documentation |

## Next Steps (Optional)

- [ ] Create migration script for existing sections (if any have transfers before this change)
- [ ] Add UI widget to display section stock summary from new API
- [ ] Add audit trail viewer in admin dashboard
- [ ] Create automated backup of inventory audit trail
- [ ] Add permission checks for section-level inventory operations

## Testing Recommendations

1. **Transfer to section**: Verify stock updates in section-specific inventory
2. **Audit trail**: Check `/api/departments/[section-code]/section/inventory?op=audit` shows incoming transfer
3. **Stock summary**: Confirm counts by status are correct for section
4. **Parent totals**: Verify parent department queries still work (backward compatibility)
5. **Manual adjustment**: Test stock take adjustments create proper audit trail

## Notes

- Section code format: `PARENT_CODE:section_slug` (e.g., `RESTAURANT:main`)
- Parent department and section have separate inventory spaces
- Drinks/Food are shared at parent level (identified by order departmentCode)
- Schema already had `sectionId` field - no migration needed
- All operations maintain backward compatibility with parent-level inventory
