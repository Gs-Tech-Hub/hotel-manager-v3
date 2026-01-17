# Employee Manager System - Complete Implementation Guide

## Overview

The Employee Manager system provides comprehensive employee lifecycle management including:
- **Employment Data Tracking**: Employment dates, salary, position, department, contract types
- **Leave Management**: Request, approve, and track employee leaves (vacation, sick, personal, unpaid)
- **Charges & Debts**: Record charges, fines, shortages, and loans for employees
- **Termination Management**: Track employee terminations with final settlement and restoration capabilities
- **Salary History**: Track all salary payments for audit and reporting

## Database Schema

### Core Models

#### `EmploymentData`
Stores primary employment information for each employee.

```prisma
model EmploymentData {
  id                    String    @id @default(cuid())
  employmentDate        DateTime  // Date employee started
  position              String    // Job position/title
  department            String?   // Department assigned
  salary                Decimal   @db.Decimal(10, 2)
  salaryType            String    @default("monthly") // monthly, hourly, annual
  salaryFrequency       String    @default("monthly") // payment frequency
  employmentStatus      String    @default("active") // active, inactive, on_leave, terminated
  contractType          String?   // permanent, temporary, contract
  reportsTo             String?   // Manager/supervisor ID
  
  // Termination data
  terminationDate       DateTime?
  terminationReason     String?
  terminationNotes      String?
  
  // Deductions & debts tracking
  totalDebts            Decimal   @db.Decimal(10, 2) @default(0)
  totalCharges          Decimal   @db.Decimal(10, 2) @default(0)

  userId String @unique
  user   PluginUsersPermissionsUser @relation(...)

  leaves    EmployeeLeave[]
  charges   EmployeeCharge[]
  termination EmployeeTermination?
}
```

#### `EmployeeLeave`
Tracks employee leave requests.

```prisma
model EmployeeLeave {
  id              String    @id @default(cuid())
  leaveType       String    // sick, vacation, personal, unpaid, etc
  startDate       DateTime
  endDate         DateTime
  numberOfDays    Int
  reason          String?
  status          String    @default("pending") // pending, approved, rejected, cancelled
  approvedBy      String?   // Admin/manager ID
  approvalDate    DateTime?
  notes           String?

  employmentDataId String
  employmentData   EmploymentData @relation(...)
}
```

#### `EmployeeCharge`
Tracks charges, fines, debts, and shortages.

```prisma
model EmployeeCharge {
  id              String    @id @default(cuid())
  chargeType      String    // debt, fine, shortage, advance, loan, etc
  amount          Decimal   @db.Decimal(10, 2)
  description     String?
  reason          String?
  date            DateTime
  dueDate         DateTime?
  status          String    @default("pending") // pending, paid, partially_paid, waived, cancelled
  paidAmount      Decimal   @db.Decimal(10, 2) @default(0)
  paymentDate     DateTime?
  paymentMethod   String?
  notes           String?

  employmentDataId String
  employmentData   EmploymentData @relation(...)
}
```

#### `EmployeeTermination`
Tracks employee termination and final settlement.

```prisma
model EmployeeTermination {
  id              String    @id @default(cuid())
  terminationDate DateTime
  reason          String    // resignation, dismissal, retirement, layoff, etc
  details         String?
  finalSettlement Decimal   @db.Decimal(10, 2)
  settlementStatus String  @default("pending") // pending, completed, disputed
  settlementDate  DateTime?
  notes           String?

  employmentDataId String @unique
  employmentData   EmploymentData @relation(...)
}
```

#### `SalaryPayment`
Audit trail for all salary payments.

```prisma
model SalaryPayment {
  id              String    @id @default(cuid())
  userId          String
  paymentDate     DateTime
  grossSalary     Decimal   @db.Decimal(10, 2)
  deductions      Decimal   @db.Decimal(10, 2) @default(0)
  netSalary       Decimal   @db.Decimal(10, 2)
  paymentMethod   String?
  status          String    @default("completed") // pending, completed, failed
  notes           String?
}
```

## API Endpoints

### Employee Management

#### `GET /api/employees`
List all employees with employment data.

**Query Parameters:**
- `status` - Filter by employment status (active, inactive, on_leave, terminated)
- `department` - Filter by department
- `page` - Pagination page (default: 1)
- `limit` - Results per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": "emp_123",
        "email": "john@example.com",
        "firstname": "John",
        "lastname": "Doe",
        "employmentData": {
          "position": "Manager",
          "department": "Sales",
          "salary": 5000,
          "employmentStatus": "active"
        },
        "totalCharges": 2,
        "activeLeaves": 0
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "pages": 5
    }
  }
}
```

#### `POST /api/employees`
Create a new employee with employment data.

**Request Body:**
```json
{
  "email": "jane@example.com",
  "username": "jane_doe",
  "password": "secure_password",
  "firstName": "Jane",
  "lastName": "Doe",
  "employmentDate": "2024-01-15",
  "position": "Senior Developer",
  "department": "Engineering",
  "salary": "6000",
  "salaryType": "monthly",
  "salaryFrequency": "monthly",
  "contractType": "permanent",
  "roles": [
    { "roleId": "role_123", "departmentId": "dept_456" }
  ]
}
```

### Employment Data

#### `GET /api/employees/[id]/employment`
Get employment data for a specific employee.

#### `POST /api/employees/[id]/employment`
Create or update employment data.

**Request Body:**
```json
{
  "employmentDate": "2024-01-15",
  "position": "Senior Developer",
  "department": "Engineering",
  "salary": "6000",
  "salaryType": "monthly",
  "salaryFrequency": "monthly",
  "contractType": "permanent",
  "reportsTo": "manager_emp_id"
}
```

### Leave Management

#### `GET /api/employees/[id]/leaves`
Get all leaves for an employee.

**Query Parameters:**
- `status` - Filter by leave status (pending, approved, rejected, cancelled)
- `year` - Filter by year

#### `POST /api/employees/[id]/leaves`
Create a new leave request.

**Request Body:**
```json
{
  "leaveType": "vacation",
  "startDate": "2024-02-10",
  "endDate": "2024-02-15",
  "numberOfDays": 5,
  "reason": "Family vacation"
}
```

#### `PUT /api/employees/[id]/leaves/[leaveId]`
Approve, reject, or cancel a leave request.

**Request Body:**
```json
{
  "status": "approved",
  "notes": "Approved by HR"
}
```

### Charges & Debts

#### `GET /api/employees/[id]/charges`
Get all charges for an employee.

**Query Parameters:**
- `status` - Filter by charge status
- `chargeType` - Filter by charge type

#### `POST /api/employees/[id]/charges`
Create a new charge.

**Request Body:**
```json
{
  "chargeType": "debt",
  "amount": "500",
  "description": "Cash shortage",
  "reason": "Till shortage",
  "date": "2024-02-01",
  "dueDate": "2024-03-01"
}
```

#### `PUT /api/employees/[id]/charges/[chargeId]`
Update a charge (record payment, status change, etc).

**Request Body:**
```json
{
  "paidAmount": "500",
  "status": "paid",
  "paymentDate": "2024-02-28",
  "paymentMethod": "bank_transfer"
}
```

### Termination

#### `GET /api/employees/[id]/termination`
Get termination record if exists.

#### `POST /api/employees/[id]/termination`
Terminate an employee.

**Request Body:**
```json
{
  "terminationDate": "2024-03-31",
  "reason": "resignation",
  "details": "Resignation letter received",
  "finalSettlement": "10000"
}
```

#### `PUT /api/employees/[id]/termination`
Update termination settlement status.

**Request Body:**
```json
{
  "settlementStatus": "completed",
  "settlementDate": "2024-03-31",
  "notes": "Final payment processed"
}
```

#### `DELETE /api/employees/[id]/termination`
Restore a terminated employee (undo termination).

## UI Components

### `<EmployeeList />`
Displays a searchable, filterable list of employees.
- Search by name or email
- Filter by employment status
- Pagination support
- Quick access to employee details

### `<EmployeeDetail />`
Complete employee profile with tabs for:
- Employment information
- Leave management
- Charges and debts
- Termination record

### `<EmploymentForm />`
Form to manage employment data:
- Employment date, position, department
- Salary and payment frequency
- Contract type
- Manager/supervisor assignment

### `<EmployeeLeavesList />`
Manage employee leave requests:
- View all leave requests
- Create new leave requests
- Approve/reject pending leaves
- Filter by leave type and status

### `<EmployeeChargesList />`
Track employee charges and debts:
- Add charges, fines, debts, loans
- Record payments
- Update charge status
- View statistics (total, paid, pending)

### `<EmployeeTerminationForm />`
Handle employee termination:
- Record termination date and reason
- Track final settlement
- Manage settlement status
- Restore terminated employees if needed

## Permissions

Create these permissions in your RBAC system:

```json
{
  "employees.view": "View employee records",
  "employees.create": "Create new employees",
  "employees.edit": "Edit employee information",
  "employees.delete": "Delete/deactivate employees",
  "employees.employment.manage": "Manage employment data",
  "employees.leaves.manage": "Approve and manage leaves",
  "employees.charges.manage": "Add and manage charges",
  "employees.termination.manage": "Manage employee termination"
}
```

## Usage Examples

### Creating an Employee

```typescript
const response = await fetch('/api/employees', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    username: 'john_doe',
    password: 'secure_password',
    firstName: 'John',
    lastName: 'Doe',
    employmentDate: '2024-01-15',
    position: 'Manager',
    department: 'Sales',
    salary: '5000',
  }),
});
```

### Recording a Leave

```typescript
const response = await fetch('/api/employees/emp_123/leaves', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    leaveType: 'vacation',
    startDate: '2024-02-10',
    endDate: '2024-02-15',
    numberOfDays: 5,
    reason: 'Family vacation',
  }),
});
```

### Adding a Charge

```typescript
const response = await fetch('/api/employees/emp_123/charges', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chargeType: 'fine',
    amount: '50',
    description: 'Lateness fine',
    reason: 'Arrived 30 minutes late',
    date: '2024-02-01',
  }),
});
```

### Recording Payment

```typescript
const response = await fetch('/api/employees/emp_123/charges/charge_456', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paidAmount: '50',
    status: 'paid',
    paymentDate: '2024-02-15',
    paymentMethod: 'cash',
  }),
});
```

### Terminating an Employee

```typescript
const response = await fetch('/api/employees/emp_123/termination', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    terminationDate: '2024-03-31',
    reason: 'dismissal',
    details: 'Performance issues',
    finalSettlement: '10000',
  }),
});
```

## Dashboard Page

Add a new page at `app/(dashboard)/employees/page.tsx`:

```typescript
import { EmployeeList } from '@/components/admin/employee-list';
import { ProtectedRoute } from '@/components/protected-route';

export default function EmployeesPage() {
  return (
    <ProtectedRoute requiredRoles={['admin', 'hr_manager']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Employee Management</h1>
          <p className="text-muted-foreground">Manage employment, leaves, charges, and terminations</p>
        </div>
        <EmployeeList />
      </div>
    </ProtectedRoute>
  );
}
```

## Database Seeding

After running migrations, seed initial permissions:

```bash
npm run seed:permissions
```

This will create the required permissions for employee management in your RBAC system.

## Migration & Deployment

1. **Update Prisma Schema**
   ```bash
   npx prisma migrate dev --name add_employee_manager
   ```

2. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

3. **Deploy to Production**
   ```bash
   npx prisma migrate deploy
   ```

## Key Features

✅ **Comprehensive Employee Lifecycle**: From hiring to termination
✅ **Leave Management**: Multiple leave types with approval workflow
✅ **Debt Tracking**: Track charges, fines, advances, and loans
✅ **Payment History**: Audit trail of all salary payments
✅ **Termination Management**: Safe, reversible termination process
✅ **Department Tracking**: Organize employees by department
✅ **Flexible Compensation**: Support for multiple salary types
✅ **RBAC Integration**: Full integration with role-based access control
✅ **Audit Trail**: Complete history of all changes

## Future Enhancements

- Salary slip generation and distribution
- Attendance tracking integration
- Performance review system
- Benefits management
- Payroll integration
- Shift scheduling system
- Promotion and transfer tracking
- Training and development records
- Document management (contracts, policies)
- Reporting and analytics dashboard

---

**Last Updated**: January 16, 2026
