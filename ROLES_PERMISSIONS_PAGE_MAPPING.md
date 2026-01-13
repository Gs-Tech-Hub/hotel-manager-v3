# Roles, Permissions, and Page Access Mapping

## Overview
This document maps roles to their permissions and the pages they can access. Ensures consistency between role permissions and page access rules.

---

## Role Definitions and Permissions

### Admin Role
**Code:** `admin`  
**Permissions:** * (full system access)  
**Pages:** All pages (/dashboard/admin/*)

### Manager Role
**Code:** `manager`  
**Permissions:**
- `orders.read`, `orders.create`, `orders.update`
- `payments.read`, `payments.process`, `payments.refund`
- `inventory.read`, `inventory.update`, `inventory.transfer`
- `bookings.read`, `bookings.create`, `bookings.update`
- `departments.read`
- `reports.read`, `reports.generate`

**Pages:**
- `/dashboard`
- `/orders`, `/bookings`, `/customers`, `/rooms`, `/inventory`, `/departments`, `/employees`
- `/pos/departments`, `/pos/inventory`

---

### Cashier Role
**Code:** `cashier`  
**Permissions:**
- `orders.read`, `orders.create`, `orders.update`
- `payments.read`, `payments.process`, `payments.refund`
- `inventory.read`
- `departments.read`

**Pages:**
- `/pos` (main POS page)
- `/pos/orders` (order management)
- `/pos/food`, `/pos/drinks` (category menus)
- `/pos-terminals` (POS terminal access)

---

### POS Staff Role
**Code:** `pos_staff`  
**Permissions:**
- `orders.read`, `orders.create`, `orders.update`
- `inventory.read`
- `departments.read`

**Pages:**
- `/pos`
- `/pos/orders`, `/pos/food`, `/pos/drinks`

---

### POS Manager Role
**Code:** `pos_manager`  
**Permissions:**
- `orders.read`, `orders.create`, `orders.update`, `orders.delete`, `orders.cancel`
- `payments.read`, `payments.process`, `payments.refund`
- `inventory.read`, `inventory.update`, `inventory.transfer`
- `departments.read`, `departments.update`
- `reports.read`, `reports.generate`

**Pages:**
- `/pos` (full POS access)
- `/pos/orders`, `/pos/food`, `/pos/drinks` (full order management)
- `/pos/departments`, `/pos/inventory` (department and inventory management)
- `/pos-terminals`

---

### Terminal Operator Role
**Code:** `terminal_operator`  
**Permissions:**
- `pos_terminal.access`
- `orders.read`, `orders.create`, `orders.update`
- `inventory.read`

**Pages:**
- `/pos-terminals` (terminal-specific access)

---

### Staff Role
**Code:** `staff`  
**Permissions:**
- `orders.read`, `orders.create`, `orders.update`
- `inventory.read`
- `departments.read`
- `reports.read`

**Pages:**
- `/pos`, `/pos/orders`, `/pos/food`, `/pos/drinks`

---

### Receptionist Role
**Code:** `receptionist`  
**Permissions:**
- `bookings.create`, `bookings.read`, `bookings.update`, `bookings.delete`
- `customers.read`, `customers.create`, `customers.update`
- `rooms.read`
- `departments.read`

**Pages:**
- `/bookings` (full booking management)
- `/customers` (customer management)
- `/rooms` (room viewing)

---

### Inventory Staff Role
**Code:** `inventory_staff`  
**Permissions:**
- `inventory.read`, `inventory.create`, `inventory.update`, `inventory.transfer`
- `departments.read`

**Pages:**
- `/inventory` (inventory management)

---

### Employee Role
**Code:** `employee`  
**Permissions:**
- `orders.read`
- `inventory.read`
- `bookings.read`
- `departments.read`
- `reports.read`

**Pages:**
- Dashboard (authenticated only)

---

## Page Access Rules

| Page | Required Roles | Required Permissions | Admin Bypass |
|------|----------------|----------------------|--------------|
| `/dashboard` | — | — | Authenticated only |
| `/dashboard/admin/*` | admin | — | Yes |
| `/pos` | pos_staff, cashier, pos_manager, admin | orders.read | Yes |
| `/pos/orders*` | pos_staff, cashier, pos_manager, admin | orders.read | Yes |
| `/pos/food*` | pos_staff, cashier, pos_manager, admin | orders.read | Yes |
| `/pos/drinks*` | pos_staff, cashier, pos_manager, admin | orders.read | Yes |
| `/pos/departments*` | pos_manager, admin | departments.read | Yes |
| `/pos/inventory*` | pos_manager, admin | inventory.read | Yes |
| `/pos-terminals*` | terminal_operator, cashier, pos_manager, admin | pos_terminal.access | Yes |
| `/bookings*` | receptionist, manager, admin | bookings.read | Yes |
| `/customers*` | receptionist, manager, admin | customers.read | Yes |
| `/rooms*` | receptionist, manager, admin | rooms.read | Yes |
| `/inventory*` | inventory_staff, manager, admin | inventory.read | Yes |
| `/departments*` | manager, admin | departments.read | Yes |
| `/employees*` | manager, admin | employees.read | Yes |
| `/discounts*` | — | discounts.create, discounts.read, or discounts.delete | Yes |
| `/docs*`, `/docs*`, `/documentation*`, etc | — | — | Authenticated only |

---

## Permission Hierarchy

### Orders (POS/Operations)
- `orders.read` - View orders
- `orders.create` - Create new orders
- `orders.update` - Update order details
- `orders.delete` - Delete orders
- `orders.cancel` - Cancel orders

### Payments
- `payments.read` - View payments
- `payments.process` - Process payments
- `payments.refund` - Process refunds

### Inventory Management
- `inventory.read` - View inventory
- `inventory.create` - Create inventory items
- `inventory.update` - Update inventory quantities
- `inventory.transfer` - Transfer between departments

### Bookings & Customers
- `bookings.create`, `bookings.read`, `bookings.update`, `bookings.delete`
- `customers.read`, `customers.create`, `customers.update`
- `rooms.read` - View room information

### Department Management
- `departments.read` - View departments
- `departments.create` - Create departments
- `departments.update` - Update departments
- `departments.delete` - Delete departments

### POS Terminal
- `pos_terminal.access` - Access POS terminal functionality

### Reports
- `reports.read` - View reports
- `reports.generate` - Generate reports
- `reports.export` - Export reports

### Discounts
- `discounts.create`, `discounts.read`, `discounts.delete`

### Employee Management
- `employees.read`, `employees.create`, `employees.update`, `employees.delete`

---

## Access Control Logic

The page access control uses the following logic:

1. **Admin Bypass**: If a user is an admin AND the page rule has `adminBypass: true`, access is granted
2. **Role Check**: If the page requires specific roles, the user must have at least one of them
3. **Permission Check (AND)**: If the page requires specific permissions (requiredPermissions), the user must have ALL of them
4. **Permission Check (OR)**: If the page requires any permissions (requiredAnyPermissions), the user must have AT LEAST ONE
5. **Authenticated Only**: If the page only requires authentication, any logged-in user can access it

---

## Implementation Files

- **Page Access Rules:** `/lib/auth/page-access.ts`
- **Permission Seeding:** `/scripts/seed-permissions.ts`
- **Role/Permission Database Models:** `/prisma/schema.prisma`
- **Sidebar Navigation:** `/components/shared/sidebar.tsx` (filters based on page access rules)

---

## Testing Checklist

- [ ] Admin user can access all pages
- [ ] Cashier can access `/pos*` and `/pos-terminals`
- [ ] POS Manager can access all POS pages (orders, food, drinks, departments, inventory, terminals)
- [ ] Receptionist can access `/bookings*`, `/customers*`, `/rooms*`
- [ ] Inventory Staff can access `/inventory*`
- [ ] Manager can access all operational pages
- [ ] Users without permissions cannot access restricted pages
- [ ] Page access rules match role permissions in seed-permissions.ts
