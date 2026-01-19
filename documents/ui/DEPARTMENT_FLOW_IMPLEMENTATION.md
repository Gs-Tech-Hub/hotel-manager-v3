# Department Flow — Implementation Details

This companion doc contains actionable implementation guidance: data models, API contracts, permission rules, terminal enforcement, offline behavior, and testing checklist for Restaurants and Bars.

1) Data model (Prisma-like pseudocode)

// Inventory (global product master)
model InventoryItem {
  id           String  @id @default(cuid())
  sku          String?
  name         String
  description  String?
  price        Int     // store in cents
  taxPercent   Float
  inventory    Int
  type         String  // 'food' | 'drink' | 'retail'
  isActive     Boolean @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

// Department
model Department {
  id          String @id @default(cuid())
  name        String
  code        String @unique
  type        String // 'restaurant' | 'bar' | ...
  terminals   Terminal[]
  menu        DepartmentMenu[]
}

model DepartmentMenu {
  id             String @id @default(cuid())
  department     Department @relation(fields: [departmentId], references: [id])
  departmentId   String
  inventoryItem  InventoryItem @relation(fields: [inventoryItemId], references: [id])
  inventoryItemId String
  localPrice     Int?  // optional override
  available      Boolean @default(true)
  createdAt      DateTime @default(now())
}

model Terminal {
  id           String @id @default(cuid())
  code         String @unique
  name         String
  department   Department @relation(fields: [departmentId], references: [id])
  departmentId String
  allowedItems DepartmentMenu[] @relation("TerminalAllowedItems")
  assignedTo   User?  // optional cashier/account
}

model Order {
  id           String @id @default(cuid())
  orderNumber  String @unique
  terminalId   String
  departmentId String
  cashierId    String
  items        Json
  subtotal     Int
  tax          Int
  total        Int
  status       String
  createdAt    DateTime @default(now())
}

2) API contracts (examples)

- Create department
  POST /api/departments
  Body: { name, code, type }
  Response: 201 { id, name, code, type }

- Add item to department menu
  PUT /api/departments/{id}/menu
  Body: { inventoryItemId, localPrice?, available? }
  Response: 200 { menuEntry }

- List department menu (paginated)
  GET /api/departments/{id}/menu?search=&page=
  Response: 200 { items: [{ id, inventoryItem: {id,name,price}, localPrice, available }] }

- Create order at terminal
  POST /api/orders
  Body: { terminalId, departmentId, cashierId, items: [{ inventoryItemId, name, unitPrice, quantity }], subtotal, tax, total }
  Server validation:
    - Verify terminal.departmentId === departmentId
    - Verify each item belongs to the department menu and is allowed for the terminal
  Response: 201 { orderId, orderNumber, receipt }

3) Permission & enforcement rules
- Roles:
  - admin: full access
  - dept_manager: limited to department(s) assigned
  - cashier: limited to assigned terminal(s)

- Enforcement at API layer (mandatory):
  - Token/session must include userId and assignedTerminalId(s).
  - When POST /api/orders arrives, server verifies user authorized for terminalId and items.
  - Department managers may update department menu; global inventory updates require inventory-admin privileges.

4) Terminal-level filtering behavior
- Terminal has an explicit allowedItems list. If empty, it inherits department menu.
- UI should fetch allowed items at terminal login: GET /api/terminals/{id}/allowed-items
- If offline, the terminal caches allowed items and menu snapshots for offline order creation.

5) Offline & sync considerations
- Terminal stores orders locally with a UUID and a status=queued when offline.
- When online, terminal POSTs queued orders to `/api/pos-terminals/offline-queue` with full payload; server returns mapping to canonical orderId/orderNumber.
- Conflict handling: if inventory shortage is discovered on sync, mark order as failed and push a correction/reconciliation flow.

6) UI components suggested (file map)
- `app/(dashboard)/departments/page.tsx` — departments list + create button
- `app/(dashboard)/departments/[id]/page.tsx` — department overview: menu, terminals, staff
- `app/(dashboard)/departments/[id]/menu/page.tsx` — search inventory + add mapping
- `components/admin/departments/menu-editor.tsx` — inventory search + add/remove
- `components/admin/pos/terminal-config.tsx` — allowed items per terminal UI

7) Migration considerations
- Add Department and DepartmentMenu tables/models to Prisma schema.
- Backfill policy: when migrating, optionally create a default Department and convert any existing food/drink-specific items into department menu entries (or leave inventory global and let admin map).

8) Testing checklist
- Unit: API validation rules (terminal-department mismatch, unauthorized user, item-not-allowed)
- Integration: Create department → add menu entries → assign terminal → create order via terminal → assert order saved and routed to department
- E2E: Terminal offline queue sync flow — create order offline, sync, verify persisted server-side order.

9) Edge cases
- Inventory price changed after item added to department menu: choose policy (live vs snapshot). Implementation should support both; default to live with localPrice override.
- Item removed from inventory while present on department menu: mark department menu item unavailable until manager resolves.
- Split payments and refunds: at order creation/store a reference that enables later refund operations tied to same department/terminal.

10) Acceptance Criteria (detailed)
- Admin can create/rename/delete departments; department list shows assigned terminals and managers.
- Managers can add inventory items to their department menu and optionally set a local price.
- Terminals only surface items that are both on a department menu and allowed by the terminal config.
- Orders created at terminals are validated server-side and include departmentId + terminalId + cashierId.

If you'd like, I can now:
- Scaffold the Department pages and the minimal API endpoints (`/api/departments/*`, `/api/departments/{id}/menu`, `/api/pos-terminals/{id}/allowed-items`, `/api/orders`) as stubs to let you run the UI end-to-end.
- Or implement the full API flow backed by Prisma (note: migrations and DB changes are required).
