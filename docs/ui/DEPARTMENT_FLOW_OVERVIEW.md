## Department Flow — Overview

Purpose
- Define how departments (Restaurants, Bars, etc.) are created, managed and connected to inventory and POS terminals.
- Provide a simple, consistent user experience for department admins and terminal users while ensuring product access is limited to the correct terminals and roles.

Actors
- Admin (global) — creates departments, configures terminals, assigns department managers and permissions.
- Department Manager — configures menu/itinerary for a single restaurant or bar (adds/removes items from their menu using inventory items).
- Terminal User / Cashier — assigned to a specific terminal; can create orders only using items permitted by their terminal/department.
- Inventory Admin — manages global inventory (food/drink items) from which department menus are built.

High-level Goals
- Departments are first-class entities (many restaurants/bars possible).
- Menu/itinerary for a department is a curated subset of global inventory (inventory -> department menu mapping).
- Terminals are associated with departments and can be configured to permit a subset of department items (role-based restrictions possible).
- Orders created at a terminal are limited to permitted items; order creation is logged and routed to the proper department for fulfillment.

Core UI flows (summary)
1. Admin creates a Department
   - Settings: name, type (restaurant|bar|retail), default tax rate, open/close hours, assigned departments code.
   - Assign/attach zero or more Terminals.

2. Inventory Admin maintains master items
   - Create/Edit global items (FoodItem, DrinkItem) in `Inventory` module with fields: id, name, price, taxCategory, inventoryCount, isActive, departmentsAllowed[] (optional).

3. Department Manager builds Menu (itinerary)
   - From `Departments > [Restaurant] > Menu` the manager searches global inventory and adds items to the department menu.
   - Adding an item does not consume inventory; it creates a mapping entry (department_menu) referencing the inventory item with optional overrides (displayName, localPrice, availableTimes, modifiers).

4. Terminal assignment and restriction
   - Admin or Department Manager assigns Terminals to departments (e.g., POS-001 belongs to Restaurant A). Each terminal gets a role and item filters.
   - Terminal-level filter allows restricting which department menu items are actually available on that device (useful for bar-only vs full-restaurant terminals).

5. Cashier/Terminal usage
   - Cashiers sign in to their assigned terminal (cashier login), open a shift, and create orders using only allowed items.
   - Orders get recorded to `/api/orders` and include: terminalId, departmentCode, cashierId, items[], subtotal, tax, total.

Key constraints and policies
- A Department Menu is a curated view of Inventory (no duplication of product master data; store only mapping + overrides).
- Terminal users can only access terminals assigned to their user role. Tokens or session state must include terminalId and allowed items list.
- Managers can only manage the department(s) they are assigned to.
- Inventory changes (price, active flag) should propagate to department menus based on policy: either live (reflect global changes) or snapshot (store local override). Documented in implementation doc.

Where this appears in the app (recommended routes)
- Admin: `app/(dashboard)/departments/page.tsx` (list)
- Department detail: `app/(dashboard)/departments/[id]/page.tsx` (overview, terminals, menu)
- Department menu: `app/(dashboard)/departments/[id]/menu/page.tsx` (search inventory, add/remove)
- Terminals: `app/(dashboard)/pos-terminals/*` (management + checkout)
- Terminal checkout UI: `app/(dashboard)/pos-terminals/[id]/checkout/page.tsx`

Integration highlights
- Orders API: `POST /api/orders` includes terminal and department metadata.
- Inventory API: `GET /api/inventory`, `GET /api/inventory/[id]` to populate department menu.
- Departments API: `GET /api/departments`, `POST /api/departments`, `GET /api/departments/[id]/menu`, `PUT /api/departments/[id]/menu`.

Acceptance criteria (short)
- Admin can create a department and assign at least one terminal.
- Department manager can add items to department menu from existing inventory.
- Cashier at a terminal can only add permitted items to an order and complete checkout.

Notes
- This doc is an overview — implementation details (DB models, API contracts, permissions, and offline behavior) are in the companion document: `DEPARTMENT_FLOW_IMPLEMENTATION.md`.
