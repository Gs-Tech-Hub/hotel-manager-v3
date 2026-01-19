# Department-Level Extras Management Implementation

## Overview
Extras now follow the same architectural pattern as inventory items:
- **Department Level**: Extras are allocated to departments (global pool)
- **Section Level**: Extras are transferred from departments to sections (operational pool)
- **Consistent Management**: Both inventory and extras use the same multi-tiered allocation system

## Database Schema Changes

### New Model: `DepartmentExtra`
```prisma
model DepartmentExtra {
  id String @id @default(cuid())

  departmentId String
  department   Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  sectionId String?
  section   DepartmentSection? @relation(fields: [sectionId], references: [id], onDelete: Cascade)

  extraId String
  extra   Extra @relation(fields: [extraId], references: [id], onDelete: Cascade)

  quantity Int @default(0)
  reserved Int @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([departmentId, sectionId, extraId])
  @@index([departmentId])
  @@index([sectionId])
  @@index([extraId])
  @@map("department_extras")
}
```

### Updated `Extra` Model
Added department-level linkage while maintaining section-specific extras:
- `departmentId` - Links extra to department (department-level tracking)
- `departmentSectionId` - Optional section-specific link (for section-only extras)
- Relation: `departmentExtras` array for department-scoped allocations

### Updated `Department` & `DepartmentSection` Models
- `Department.departmentExtras` - Relation to all extras allocated to this department
- `Department.extras` - Relation to all extras linked to this department
- `DepartmentSection.departmentExtras` - Relation to section-specific allocations

## Service Layer

### New Service: `DepartmentExtrasService`
Location: [src/services/department-extras.service.ts](src/services/department-extras.service.ts)

**Core Methods:**
- `getDepartmentExtras(departmentId, sectionId?)` - Fetch extras for department/section
- `allocateExtraToDepartment(departmentId, extraId, quantity, sectionId?)` - Allocate extras to department
- `transferExtrasBetweenSections()` - Move extras between sections within same department
- `deductExtraUsage()` - Deduct extras when used in orders
- `getSectionExtrasSummary()` - Get availability stats for a section
- `getUnallocatedExtras()` - Get extras not yet allocated to a department
- `reconcileDepartmentExtras()` - Fix orphaned or missing allocations

## API Routes

### Department Extras Management
**GET/POST** `/api/departments/[code]/extras`
- GET: Fetch all extras for department (optionally filtered by section)
- POST: Allocate new extras to department
- Params: `sectionId` (optional query parameter for filtering)

### Extras Transfers
**POST** `/api/departments/[code]/extras/transfer`
- Transfer extras between sections within same department
- Validates quantity availability in source section
- Body: `{ extraId, sourceSectionId, destinationSectionId, quantity }`

### Unallocated Extras
**GET** `/api/departments/[code]/extras/unallocated`
- Fetch all extras not yet allocated to this department
- Useful for allocation UI to show available extras

## Management Workflow

### 1. Create/Manage Extras (Global Level)
```typescript
// Create standalone extra
const extra = await extrasService.createExtra({
  name: 'Extra Sauce',
  unit: 'container',
  price: 50, // cents
  departmentId: dept.id,
  trackInventory: false
});

// Create inventory-tracked extra
const inventoryExtra = await extrasService.createExtraFromProduct({
  productId: inventory.id,
  unit: 'portion',
  departmentId: dept.id,
  trackInventory: true
});
```

### 2. Allocate Extras to Department
```typescript
// Allocate to department (no section)
await departmentExtrasService.allocateExtraToDepartment(
  departmentId,
  extraId,
  quantity
);

// Allocate to specific section
await departmentExtrasService.allocateExtraToDepartment(
  departmentId,
  extraId,
  quantity,
  sectionId
);
```

### 3. Transfer Between Sections
```typescript
await departmentExtrasService.transferExtrasBetweenSections(
  departmentId,
  extraId,
  sourceSectionId,
  destinationSectionId,
  quantity
);
```

### 4. Usage in Orders
```typescript
// When extra is used in order line
await departmentExtrasService.deductExtraUsage(
  departmentId,
  sectionId,
  extraId,
  quantityUsed
);
```

## Data Flow

```
Extras Created (Global Registry)
         ↓
Allocate to Department (Quantity tracked at dept level)
         ↓
Transfer to Section (Available for use in orders)
         ↓
Deduct on Order (Quantity tracked per section)
```

## Consistency with Inventory

### Parallel Structure

| Aspect | Inventory | Extras |
|--------|-----------|--------|
| **Global Model** | `InventoryItem` | `Extra` |
| **Department Allocation** | `DepartmentInventory` | `DepartmentExtra` |
| **Allocation Columns** | quantity, reserved | quantity, reserved |
| **Transfer System** | `DepartmentTransfer` | Built-in to service |
| **Section Scoping** | `sectionId` optional | `sectionId` optional |
| **Tracking** | quantity per dept/section | quantity per dept/section |
| **Reconciliation** | Auto-sync via script | Via `reconcileDepartmentExtras()` |

## Benefits

1. **Unified Management** - Extras and inventory follow same allocation pattern
2. **Department Control** - Managers allocate extras to departments first
3. **Section Operations** - Staff works with section-level quantities
4. **Transfer Visibility** - Track extras movement between sections
5. **Inventory Integration** - Extras can track inventory impact on orders
6. **Scalability** - Same architecture supports multiple departments/sections

## Key Files Modified/Created

- `prisma/schema.prisma` - Added DepartmentExtra model, updated Extra/Department relations
- `src/services/department-extras.service.ts` - New service for extras management
- `app/api/departments/[code]/extras/route.ts` - GET/POST endpoints
- `app/api/departments/[code]/extras/transfer/route.ts` - Transfer endpoint
- `app/api/departments/[code]/extras/unallocated/route.ts` - Unallocated listing
- `src/services/extras.service.ts` - Updated to support department field

## Migration Status

✅ Database migration created: `2026010613_3842_add_department_extras_tracking`
✅ Prisma client regenerated
✅ All API routes compiled successfully
✅ Build passes with 0 errors

## Next Steps

1. Update UI components to show department extras management
2. Create extras allocation/transfer UI for department managers
3. Update order UI to show section-level extras availability
4. Add reconciliation script for department extras (similar to inventory)
5. Implement audit logging for extras transfers
