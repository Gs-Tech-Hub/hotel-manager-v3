# Employee Roles - Quick Reference

## 🎯 The 7 Employee Roles

```
┌─────────────────────────────────────────────────────────────────┐
│ STAFF MEMBER - Basic operations (orders, inventory)             │
├─────────────────────────────────────────────────────────────────┤
│ Can: Create/read/update orders, view inventory, view profile    │
│ Best For: Entry-level staff, general hotel operations           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ MANAGER - Full department management                            │
├─────────────────────────────────────────────────────────────────┤
│ Can: Manage orders, inventory, reports, staff                   │
│ Best For: Department heads, supervisors, shift leaders          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ KITCHEN STAFF - Food preparation & orders                       │
├─────────────────────────────────────────────────────────────────┤
│ Can: View orders, update status, view inventory                 │
│ Best For: Chefs, cooks, kitchen prep                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ BAR STAFF - Beverage service & orders                           │
├─────────────────────────────────────────────────────────────────┤
│ Can: View orders, update status, view inventory                 │
│ Best For: Bartenders, bar service                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FRONT DESK - Bookings & check-in                                │
├─────────────────────────────────────────────────────────────────┤
│ Can: Manage bookings, view rooms, view orders                   │
│ Best For: Receptionists, check-in agents, booking staff         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ INVENTORY MANAGER - Full stock control                          │
├─────────────────────────────────────────────────────────────────┤
│ Can: Full inventory CRUD, transfers, reports                    │
│ Best For: Inventory coordinators, stock managers                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ VIEWER - Read-only access                                       │
├─────────────────────────────────────────────────────────────────┤
│ Can: View orders, inventory, bookings, reports                  │
│ Best For: Auditors, analysts, reporting team                    │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Assign Role to Employee
1. Go to `/dashboard/employees`
2. Click "Add Employee" or "Edit"
3. Fill basic info → Click "Next"
4. Click "Add Role" → Select role → (optional) Select department
5. Click "Save"

### Seed Roles to Database
```bash
npm run seed:employee-roles
```

### View Roles
- Admin page: `/dashboard/admin/roles`
- See all roles and their permissions

## 📊 Role vs Permission

**Role** = Collection of permissions (e.g., "Kitchen Staff")
**Permission** = Individual action (e.g., "orders.read")

```
Kitchen Staff Role
├─ orders.read ✓
├─ orders.update ✓
├─ inventory.read ✓
├─ profile.read ✓
└─ orders.create ✗
```

## 🏢 Department Scoping

Roles can be limited to specific departments:

```
Employee: John Smith

Role: Manager, Department: Kitchen
  → Can only manage kitchen-related items

Role: Manager, Department: Bar
  → Can only manage bar-related items

Role: Inventory Manager, Department: (none)
  → Can manage all inventory across hotel
```

## 🔑 Key Permissions

| Permission | Used By | Meaning |
|-----------|---------|---------|
| orders.create | Staff, Manager | Create new order |
| orders.read | All except Viewer | View orders |
| orders.update | Staff, Kitchen, Bar, Manager | Update order status |
| orders.delete | Manager only | Delete order |
| inventory.read | Staff, Kitchen, Bar, Inventory, Viewer | View stock |
| inventory.update | Manager, Inventory | Modify stock |
| inventory.transfer | Manager, Inventory | Move between departments |
| bookings.read | Front Desk, Viewer | View bookings |
| bookings.create | Front Desk only | Create new booking |
| rooms.read | Front Desk only | View room info |
| reports.read | Manager, Inventory, Viewer | View reports |
| staff.read | Manager only | View staff list |
| profile.read | All roles | View own profile |

## 🛠️ Common Scenarios

### Scenario 1: New Kitchen Staff Member
1. Create employee in `/dashboard/employees`
2. Assign "Kitchen Staff" role
3. Select "Kitchen" department
4. Result: Can view/update orders and inventory in kitchen

### Scenario 2: General Manager (Multiple Departments)
1. Create employee
2. Assign "Manager" role to Kitchen department
3. Assign "Manager" role to Bar department
4. Assign "Manager" role to Front Desk department
5. Result: Manager can see all departments independently

### Scenario 3: Inventory Auditor
1. Create employee
2. Assign "Viewer" role
3. No department needed (read-only access everywhere)
4. Result: Can view all data but cannot modify anything

### Scenario 4: Front Desk Lead
1. Create employee
2. Assign "Manager" role to Front Desk department
3. Assign "Front Desk" role (optional, for extra permissions)
4. Result: Can manage front desk operations and staff

## 📋 Role Codes (for API)

When using API, use these role codes:
- `staff` → Staff Member
- `manager` → Manager
- `kitchen-staff` → Kitchen Staff
- `bar-staff` → Bar Staff
- `front-desk` → Front Desk
- `inventory-manager` → Inventory Manager
- `viewer` → Viewer

## ✅ Best Practices

1. **Assign minimum permissions** - Only give what's needed
2. **Use departments** - Scope roles to departments when possible
3. **Multi-role carefully** - Document why employee needs multiple roles
4. **Audit quarterly** - Review who has what roles
5. **Remove old roles** - Clean up when employee changes position
6. **Document custom roles** - If you create custom roles, document why

## ⚡ Common Issues & Solutions

### Role dropdown is empty
→ Run `npm run seed:employee-roles` again

### Employee can't see page after role assigned
→ Check employee has required permission for page
→ Refresh browser (clear cache if needed)

### Can't assign department to role
→ Department must exist first
→ Only certain roles support department scoping

### Need to change role
→ Edit employee → Remove old role → Add new role → Save

## 📞 Support

**For more details:** See [EMPLOYEE_ROLES_GUIDE.md](EMPLOYEE_ROLES_GUIDE.md)

**For employee management:** See [EMPLOYEE_MANAGEMENT_COMPLETE.md](EMPLOYEE_MANAGEMENT_COMPLETE.md)

---

**Last Updated:** January 9, 2026
