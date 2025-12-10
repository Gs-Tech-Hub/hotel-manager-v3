# Section Management Migration Guide

## What Changed?

### Before (Old Approach)
- Sections stored as `departmentCode` in `OrderLine` table only
- Inventory tracked only at **parent department level**
- Section stock was an aggregation of orders (no independent inventory records)
- No clear audit trail for transfers to sections
- Hard to see "what stock belongs to which section"

**Problem:** Sections were second-class citizens - treated as metadata on orders, not as independent entities.

### After (New Approach)
- Sections are first-class entities in `DepartmentSection` table
- Inventory tracked at **section level** via `DepartmentInventory.sectionId`
- Transfers to sections create section-specific inventory records
- Clear audit trail: "Stock transferred from WAREHOUSE to RESTAURANT:main on 2025-12-09"
- Easy to see: "RESTAURANT:main has 50 units of Vodka"

**Benefit:** Sections have independent inventory management, clear audit trails, and proper isolation.

## Migration Path

### Phase 1: Schema Already Ready ✅
- `DepartmentInventory` already has `sectionId` field
- `DepartmentSection` already has `inventories` relation
- **No database migration needed**

### Phase 2: Code Deployment

1. **Deploy these new files:**
   - `src/services/section-inventory.service.ts` (new section inventory service)
   - `app/api/departments/[code]/section/inventory/route.ts` (new API endpoints)

2. **Update these files:**
   - `src/services/transfer.service.ts` (enhanced section handling)
   - `src/services/section.service.ts` (fixed section code resolution)
   - `app/api/departments/[code]/stock/route.ts` (section-aware stock queries)

3. **Documentation:**
   - `docs/SECTION_MANAGEMENT_PROTOCOL.md` (protocol specification)
   - `SECTION_INVENTORY_IMPLEMENTATION.md` (this implementation guide)

### Phase 3: Data Consideration

**For existing data (if any):**

If you have sections created before this change with transfers:

```sql
-- Check if any transfers went to sections
SELECT t.* FROM department_transfers t 
WHERE t.notes LIKE '%toDepartmentCode%:%'

-- If found, you may want to populate DepartmentInventory.sectionId
-- for historical accuracy (optional - future transfers will use new approach)
```

**For new operations:**
- All future transfers to sections automatically create `DepartmentInventory.sectionId` records
- Parent-level inventory queries still work (backward compatible)

## How Transfers Work Now

### Scenario: Transfer from Warehouse to Restaurant Main Section

**Step 1: Create Transfer**
```bash
POST /api/departments/WAREHOUSE/transfer
{
  "toDepartmentCode": "RESTAURANT:main",
  "items": [{"type": "inventoryItem", "id": "vodka-001", "quantity": 20}]
}
```

**Step 2: Transfer Service Processing**
```
Input: toDepartmentCode = "RESTAURANT:main"
  ↓
Detect section code (contains ":")
  ↓
Look up RESTAURANT department ✓
Look up "main" section ✓
  ↓
Create transfer with:
  - toDepartmentId = RESTAURANT.id (parent)
  - notes = {"toDepartmentCode": "RESTAURANT:main"}
  ↓
Transfer Approval:
  - Parses section code from notes
  - Creates DepartmentInventory with sectionId = main_section.id
  - Stock is now isolated to RESTAURANT:main section
```

**Step 3: Query Section Stock**
```bash
GET /api/departments/RESTAURANT:main/section/inventory
→ Returns only RESTAURANT:main inventory items (sectionId-filtered)

GET /api/departments/RESTAURANT:main/section/inventory?op=audit
→ Shows "20 units transferred from WAREHOUSE on 2025-12-09"
```

## Key Differences: Parent vs Section Queries

### Parent Department Query (Old Behavior - Still Works)
```bash
GET /api/departments/RESTAURANT/stock
→ Returns: all items at parent level
→ Inventory: WHERE sectionId = null
```

### Section Query (New Behavior)
```bash
GET /api/departments/RESTAURANT:main/stock
→ Returns: items for RESTAURANT:main only
→ Inventory: WHERE sectionId = 'main_section_id'
```

## Backward Compatibility

✅ **Fully backward compatible:**
- Parent department queries still work (unchanged)
- Existing section code format in orders (`departmentCode`) still works
- Old transfers to parent departments unchanged
- Only new transfers to sections use section-scoped inventory

⚠️ **One change in behavior:**
- Stock display for sections now shows section-specific inventory (instead of aggregating orders)
- This is more accurate and clear

## Testing the Migration

### 1. Verify Old Functionality Works
```bash
# Should still work (parent-level query)
GET /api/departments/WAREHOUSE/stock
GET /api/departments/WAREHOUSE/transfer (create transfer to parent)
```

### 2. Test New Functionality
```bash
# New section-specific features
GET /api/departments/RESTAURANT:main/section/inventory
GET /api/departments/RESTAURANT:main/section/inventory?op=summary
GET /api/departments/RESTAURANT:main/section/inventory?op=audit

# Transfer to section
POST /api/departments/WAREHOUSE/transfer
{
  "toDepartmentCode": "RESTAURANT:main",
  "items": [{"type": "inventoryItem", "id": "item-123", "quantity": 10}]
}
```

### 3. Verify Audit Trail
```bash
# After transfer, check audit
GET /api/departments/RESTAURANT:main/section/inventory?op=audit
# Should show incoming transfer from WAREHOUSE
```

## Rollback (If Needed)

If you need to roll back:
1. Revert code changes to `transfer.service.ts`, `section.service.ts`, `stock/route.ts`
2. Remove new files: `section-inventory.service.ts` and `/section/inventory/route.ts`
3. System reverts to old behavior (section stock as order aggregation)
4. No database changes needed (schema is compatible both ways)

## FAQ

**Q: Do I need to migrate existing data?**
A: No. The schema is backward compatible. Old transfers still work. New transfers use the new approach automatically.

**Q: What about drinks in sections?**
A: Drinks are shared at parent level (same bar, just different sections). Stock is at parent, orders are tagged with section code.

**Q: Can I still query parent department inventory?**
A: Yes. `GET /api/departments/WAREHOUSE/stock` works exactly as before.

**Q: How do I know if a transfer went to a section or parent?**
A: Check the transfer `notes` field - if it contains `"toDepartmentCode": "SECTION:code"`, it went to a section.

**Q: What about my existing UI?**
A: No changes needed. Stock display for sections now uses dedicated endpoint for accuracy, but response format is the same.

## Support & Troubleshooting

**Section code not found?**
- Verify format: `PARENT_CODE:slug` (e.g., `RESTAURANT:main`)
- Check parent department exists: `GET /api/departments/RESTAURANT`
- Check section exists: `GET /api/departments/RESTAURANT/children` (look for sections)

**Inventory not updating after transfer?**
- Check transfer status: should be `completed`
- Verify section code in notes is correct
- Query section inventory: `GET /api/departments/RESTAURANT:main/section/inventory`

**Need to adjust section stock manually?**
- Use: `POST /api/departments/RESTAURANT:main/section/inventory?op=adjust`
- Provide: `itemId`, `delta`, `reason`
- Creates audit record automatically

