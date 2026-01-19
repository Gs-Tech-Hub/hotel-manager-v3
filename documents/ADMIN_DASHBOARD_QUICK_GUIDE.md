# Admin Dashboard - Quick Navigation Guide

## New Dashboard Pages Created

All new admin pages are accessible via the `(dashboard)` layout and should be added to your sidebar navigation.

### 1. Departments Management
- **URL**: `/departments`
- **Purpose**: Create and manage departments
- **Features**:
  - View all departments
  - Create new department (code, name, description)
  - Delete departments
- **Required Permissions**: `departments.create`, `departments.delete`

### 2. Department Sections
- **URL**: `/department-sections`
- **Purpose**: Manage sections within departments
- **Features**:
  - View all sections grouped by department
  - Create new section (select department, enter name)
  - Delete sections
  - Status indicator (Active/Inactive)
- **Required Permissions**: `department_sections.create`, `department_sections.delete`

### 3. Inventory Management
- **URL**: `/inventory`
- **Purpose**: Manage inventory items
- **Features**:
  - View all inventory items
  - Filter by department
  - Create new item (name, SKU, category, quantity, unit price)
  - Delete items
  - View unit prices and quantities
- **Required Permissions**: `inventory_items.create`, `inventory_items.delete`

### 4. Discounts Management
- **URL**: `/discounts`
- **Purpose**: Create and manage discount rules
- **Features**:
  - View all active discounts
  - Create new discount (code, name, type, value, date range)
  - Delete discounts
  - Type-aware display (% for percentage, $ for fixed)
- **Required Permissions**: `discounts.create`, `discounts.delete`

### 5. Employees Management
- **URL**: `/employees`
- **Purpose**: Manage employee accounts
- **Features**:
  - View all employees
  - Create new employee (username, email, password, name)
  - Delete employees
  - Status indicator (Active/Blocked)
  - Full name display with fallback to username
- **Required Permissions**: `employees.create`, `employees.delete`

## Common UI Patterns

### Create/Add Button
Located in header next to "Refresh" button. Appears only if user has `resource.create` permission.

### Create Form
- Appears below header when "Add" button clicked
- Form fields are contextual to each resource
- Submit button disabled during creation
- Cancel button to close form

### Delete Button
- Located in Actions column of table
- Appears only if user has `resource.delete` permission
- Shows confirmation dialog before deletion
- Uses soft-delete (data retained in database, marked inactive)

### Refresh Button
- Manually refresh the list
- Appears in header next to "Add" button
- Auto-updates after create/delete operations

## API Endpoints (Direct Access)

For developers who need direct API access:

```
GET    /api/departments                    - List departments
POST   /api/departments                    - Create department
DELETE /api/departments?id={id}            - Delete department

GET    /api/admin/department-sections      - List sections
POST   /api/admin/department-sections      - Create section
DELETE /api/admin/department-sections?id={id} - Delete section

GET    /api/inventory                      - List inventory items
POST   /api/inventory                      - Create inventory item
DELETE /api/inventory?id={id}              - Delete inventory item

GET    /api/discounts                      - List discounts
POST   /api/discounts                      - Create discount
DELETE /api/discounts?id={id}              - Delete discount

GET    /api/admin/employees                - List employees
POST   /api/admin/employees                - Create employee
DELETE /api/admin/employees/{id}           - Delete employee
```

## Permission Setup

All required permissions are automatically synced to the database during setup.

### Admin User Permissions
If admin users see "Permission Denied" errors:

1. Run sync script:
   ```bash
   npx ts-node scripts/sync-admin-to-unified.ts
   ```

2. Verify permissions:
   ```bash
   npx ts-node scripts/verify-admin-permissions.ts
   ```

3. Refresh browser session to reload permissions

### Custom Role Permissions
To grant admin permissions to a custom role:

1. Access the admin panel
2. Navigate to Roles/Permissions section
3. Add these permissions to the role:
   - `departments.create`
   - `departments.delete`
   - `department_sections.create`
   - `department_sections.delete`
   - `inventory_items.create`
   - `inventory_items.delete`
   - `discounts.create`
   - `discounts.delete`
   - `employees.create`
   - `employees.delete`

## Common Issues & Solutions

### ❌ "Permission Denied" Error
**Solution**: 
1. Check user role has required permissions
2. Refresh browser session
3. Run: `npx ts-node scripts/verify-admin-permissions.ts`

### ❌ Create Button Not Showing
**Solution**:
- Verify user has `resource.create` permission
- Check permission name matches exactly (case-sensitive)

### ❌ Delete Fails with "Not Found"
**Solution**:
- Item may already be deleted
- Refresh page to see current state
- Check server logs for details

### ❌ Form Validation Errors
**Solution**:
- Fill in all required fields (marked with *)
- Email must contain @
- Username must be unique

## Form Field Reference

### Department
- **code** (required): Unique department code (e.g., "restaurant", "bar")
- **name** (required): Display name
- **description**: Optional description

### Department Section
- **name** (required): Section name
- **department** (required): Select parent department

### Inventory Item
- **name** (required): Item name
- **sku** (required): Unique stock keeping unit
- **category** (required): Item category
- **quantity**: Item quantity (default 0)
- **unitPrice**: Price in minor units (default 0)

### Discount
- **code** (required): Promo code
- **name** (required): Display name
- **type** (required): "percentage" or "fixed"
- **value** (required): Discount amount
- **startDate**: When discount starts
- **endDate**: When discount ends
- **description**: Optional description

### Employee
- **username** (required): Login username
- **email** (required): Employee email
- **password** (required): Initial password
- **firstname**: First name
- **lastname**: Last name

---

**Last Updated**: 2024
**Status**: Ready for Production
