# Employee Roles Management Guide

**Status:** ✅ Complete and Ready  
**Created:** January 9, 2026

## Overview

Employee roles have been created with a complete permission matrix. The system provides flexible role-based access control for managing hotel staff with different responsibilities.

## 🎯 Available Employee Roles

### 1. **Staff Member** (`staff`)
Basic staff with order and inventory access
- **Permissions:**
  - Create orders
  - View orders
  - Update orders
  - View inventory
  - View own profile
- **Best For:** General hotel staff, service personnel, entry-level positions
- **Department:** Can be assigned to any department

### 2. **Manager** (`manager`)
Can manage staff, orders, and reports
- **Permissions:**
  - Create, read, update, delete orders
  - View, update, and transfer inventory
  - View reports
  - View staff
  - View own profile
- **Best For:** Department heads, shift managers, supervisors
- **Department:** Typically organization-wide or specific department

### 3. **Kitchen Staff** (`kitchen-staff`)
Kitchen operations and order fulfillment
- **Permissions:**
  - View orders
  - Update order status
  - View inventory
  - View own profile
- **Best For:** Kitchen preparation, order fulfillment
- **Department:** Kitchen/Food Preparation

### 4. **Bar Staff** (`bar-staff`)
Bar operations and beverage inventory
- **Permissions:**
  - View orders
  - Update order status
  - View inventory
  - View own profile
- **Best For:** Bartenders, bar service, beverage preparation
- **Department:** Bar/Beverages

### 5. **Front Desk** (`front-desk`)
Booking and check-in management
- **Permissions:**
  - View, create, update bookings
  - View rooms
  - View orders
  - View own profile
- **Best For:** Receptionists, check-in staff, booking agents
- **Department:** Front Desk/Reception

### 6. **Inventory Manager** (`inventory-manager`)
Full inventory management and control
- **Permissions:**
  - Create, read, update, delete inventory
  - Transfer inventory between departments
  - View reports
  - View own profile
- **Best For:** Inventory coordinators, stock managers, warehouse staff
- **Department:** Inventory/Warehouse

### 7. **Viewer** (`viewer`)
Read-only access to view data
- **Permissions:**
  - View orders
  - View inventory
  - View bookings
  - View reports
  - View own profile
- **Best For:** Auditors, analytics staff, reporting team
- **Department:** Management/Admin

## 🔧 How to Assign Roles to Employees

### Via Employee Management Page

1. Navigate to `/dashboard/employees`
2. Click **"Add Employee"** or **"Edit"** on existing employee
3. Fill in basic information (Step 1)
4. Click **"Next"** to proceed to Step 2
5. Click **"Add Role"** to select a role
6. Choose role from dropdown
7. (Optional) Select department for department-scoped roles
8. Click **"Save"** to assign role
9. Employee can now have multiple roles with different department scopes

### Example: Multi-Role Employee

```
Employee: John Smith
├─ Role 1: Manager (Department: Kitchen)
│  └─ Permissions: Manage kitchen orders, inventory, staff
├─ Role 2: Manager (Department: Bar)
│  └─ Permissions: Manage bar orders, inventory, staff
└─ Role 3: Inventory Manager (No Department)
   └─ Permissions: Full inventory control across organization
```

### Via API

**POST /api/employees**
```json
{
  "email": "john@hotel.com",
  "username": "john.smith",
  "password": "SecurePassword123!",
  "firstname": "John",
  "lastname": "Smith",
  "roles": [
    {
      "roleId": "role-kitchen-staff-id",
      "departmentId": "dept-kitchen-id"
    },
    {
      "roleId": "role-manager-id",
      "departmentId": null
    }
  ]
}
```

**PUT /api/employees/[id]**
```json
{
  "email": "john.updated@hotel.com",
  "username": "john.smith",
  "firstname": "John",
  "lastname": "Smith",
  "roles": [
    {
      "roleId": "role-manager-id",
      "departmentId": "dept-kitchen-id"
    }
  ]
}
```

## 📊 Permission Matrix

| Permission | Staff | Manager | Kitchen | Bar | Front Desk | Inventory Mgr | Viewer |
|-----------|-------|---------|---------|-----|-----------|--------------|--------|
| orders.create | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| orders.read | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| orders.update | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| orders.delete | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| inventory.read | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| inventory.create | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| inventory.update | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| inventory.delete | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| inventory.transfer | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| bookings.read | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| bookings.create | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| bookings.update | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| rooms.read | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| reports.read | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| staff.read | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| profile.read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## 🏢 Department-Scoped Roles

Roles can be scoped to specific departments, allowing employees to have different permissions in different departments.

### Example: Department Manager

```
Employee: Alice Johnson
├─ Role: Manager (Department: Kitchen)
│  └─ Can manage kitchen staff, orders, and inventory
└─ Role: Manager (Department: Bar)
   └─ Can manage bar staff, orders, and inventory
```

When role is assigned **without a department**, it grants permissions across the entire organization.

### Creating Department-Scoped Roles

1. In employee form, click "Add Role"
2. Select role (e.g., "Manager")
3. Select department from dropdown
4. Click "Save"
5. Employee now has that role in that specific department

## 🔐 Security Considerations

### Role Hierarchy
- **No automatic hierarchy**: Roles don't inherit from each other
- **Each permission explicit**: Every permission must be assigned to a role
- **Override capable**: Same employee can have different roles in different departments

### Permission Enforcement
- **Server-side validation**: All permissions checked on API endpoints
- **Cannot bypass client-side**: UI respects permissions, but server enforces them
- **Audit logged**: All permission checks can be logged for security

### Best Practices
1. **Least privilege**: Assign minimum permissions needed for job function
2. **Regular review**: Audit employee roles quarterly
3. **Immediate revoke**: Remove access when employee leaves
4. **Department scoping**: Use departments to limit scope of access
5. **Multi-role complexity**: Document when employees have multiple roles

## 📋 Common Role Assignments

### By Position

| Position | Recommended Roles |
|----------|-------------------|
| Head Chef | Manager (Kitchen) + Inventory Manager |
| Bartender | Bar Staff + Kitchen Staff (if multi-section) |
| General Manager | Manager (No Dept - Global) |
| Shift Supervisor | Manager (specific dept) + Staff |
| Front Desk Agent | Front Desk |
| Inventory Clerk | Viewer + Inventory Manager |
| Auditor | Viewer (read-only) |

### By Department

**Kitchen**
- Kitchen Staff (all kitchen prep)
- Manager (kitchen lead)
- Inventory Manager (food stock)

**Bar**
- Bar Staff (all bartenders)
- Manager (bar manager)
- Inventory Manager (beverage stock)

**Front Desk**
- Front Desk (all receptionists)
- Manager (front desk lead)

**Management**
- Manager (global - all departments)
- Viewer (auditors, analytics)

## 🚀 Next Steps

### 1. Create Test Employees
```bash
npm run seed:employee-roles  # Creates all roles (already done)
```

Then navigate to `/dashboard/employees` and create test employees with different roles.

### 2. Test Role Permissions
- Login as each role
- Verify accessible pages/features
- Verify restricted actions show permission errors

### 3. Set Up Department Mapping
Assign employees to departments with appropriate roles:
- Kitchen staff → Kitchen department
- Bar staff → Bar department
- Front desk → Front desk department

### 4. Monitor & Audit
- Track permission usage
- Review role assignments quarterly
- Remove unused roles
- Create new roles as needed

## 📞 Adding Custom Roles

To add new roles or permissions, either:

### Option 1: Update Seed Script
Edit `scripts/seed-employee-roles.ts`:
1. Add new role to `EMPLOYEE_ROLES` array
2. Add permissions needed
3. Run: `npm run seed:employee-roles`

### Option 2: Use Admin UI
Navigate to `/dashboard/admin/roles`:
1. Click "Create Role"
2. Enter role code, name, description
3. Select permissions
4. Click "Save"

### Option 3: Use API
**POST /api/roles**
```json
{
  "code": "custom-role",
  "name": "Custom Role",
  "description": "Custom role for specific needs",
  "type": "employee",
  "permissionIds": ["perm-id-1", "perm-id-2"]
}
```

## 🔍 Troubleshooting

### "Role not available when assigning"
- Check role exists in database: `/dashboard/admin/roles`
- Verify role has permissions assigned
- Try refreshing the page

### "Permission denied when performing action"
- Verify employee has correct role assigned
- Check role has required permission in matrix above
- Verify role is active (not archived)

### "Department-scoped role not working"
- Ensure employee assigned with department ID
- Check department exists in system
- Verify API is checking department scope

### "Need to remove role from employee"
- Edit employee: Click "Edit" button
- Step 2: Click "Remove" on role
- Click "Save"

## 📚 Related Documentation

- [Employee Management Guide](EMPLOYEE_MANAGEMENT_COMPLETE.md)
- [RBAC Implementation Guide](docs/RBAC_IMPLEMENTATION_GUIDE.md)
- [Permissions Reference](docs/ROLES_AND_ACCESS.md)

---

**Last Updated:** January 9, 2026  
**Version:** 1.0  
**Status:** Production Ready ✅
