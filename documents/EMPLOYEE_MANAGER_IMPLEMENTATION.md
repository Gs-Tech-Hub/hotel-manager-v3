# Employee Manager - Implementation Checklist

## Database Migration

```bash
# Generate migration
npx prisma migrate dev --name add_employee_manager

# Deploy to production
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

## API Endpoints Implemented

### Employee Management
- ✅ `GET /api/employees` - List employees with filters and pagination
- ✅ `POST /api/employees` - Create new employee with employment data
- ✅ `GET /api/employees/[id]` - Get employee details
- ✅ `PUT /api/employees/[id]` - Update employee information
- ✅ `DELETE /api/employees/[id]` - Soft delete (block) employee

### Employment Data
- ✅ `GET /api/employees/[id]/employment` - Get employment data
- ✅ `POST /api/employees/[id]/employment` - Create/update employment data
- ✅ `PUT /api/employees/[id]/employment` - Update employment status

### Leave Management
- ✅ `GET /api/employees/[id]/leaves` - List leaves with filters
- ✅ `POST /api/employees/[id]/leaves` - Create leave request
- ✅ `PUT /api/employees/[id]/leaves/[leaveId]` - Approve/reject leave
- ✅ `DELETE /api/employees/[id]/leaves/[leaveId]` - Delete leave

### Charges & Debts
- ✅ `GET /api/employees/[id]/charges` - List charges with statistics
- ✅ `POST /api/employees/[id]/charges` - Add charge
- ✅ `GET /api/employees/[id]/charges/[chargeId]` - Get charge details
- ✅ `PUT /api/employees/[id]/charges/[chargeId]` - Update/record payment
- ✅ `DELETE /api/employees/[id]/charges/[chargeId]` - Delete charge

### Termination
- ✅ `GET /api/employees/[id]/termination` - Get termination record
- ✅ `POST /api/employees/[id]/termination` - Terminate employee
- ✅ `PUT /api/employees/[id]/termination` - Update settlement
- ✅ `DELETE /api/employees/[id]/termination` - Restore employee

## UI Components Implemented

- ✅ `<EmployeeList />` - List, search, and filter employees
- ✅ `<EmployeeDetail />` - Complete employee profile with tabs
- ✅ `<EmploymentForm />` - Employment data management form
- ✅ `<EmployeeLeavesList />` - Leave request management
- ✅ `<EmployeeChargesList />` - Charges and debts tracking
- ✅ `<EmployeeTerminationForm />` - Employee termination form

## Database Schema

- ✅ `EmploymentData` - Employment information and status
- ✅ `EmployeeLeave` - Leave requests and approvals
- ✅ `EmployeeCharge` - Charges, fines, and debts
- ✅ `EmployeeTermination` - Termination and settlement records
- ✅ `SalaryPayment` - Salary payment audit trail
- ✅ Updated `PluginUsersPermissionsUser` with employment relationship

## Integration Steps

### 1. Database Migration
```bash
npx prisma migrate dev --name add_employee_manager
```

### 2. Seed Permissions (Optional)
Add employee management permissions to your seed script:

```typescript
// scripts/seed-permissions.ts
const permissions = [
  { action: 'employees.view', subject: 'employees' },
  { action: 'employees.create', subject: 'employees' },
  { action: 'employees.edit', subject: 'employees' },
  { action: 'employees.delete', subject: 'employees' },
  { action: 'employees.employment.manage', subject: 'employees' },
  { action: 'employees.leaves.manage', subject: 'employees' },
  { action: 'employees.charges.manage', subject: 'employees' },
  { action: 'employees.termination.manage', subject: 'employees' },
];
```

### 3. Create Dashboard Page
Create `app/(dashboard)/employees/page.tsx`:

```typescript
'use client';

import { EmployeeList } from '@/components/admin/employee-list';
import { ProtectedRoute } from '@/components/protected-route';

export default function EmployeesPage() {
  return (
    <ProtectedRoute requiredRoles={['admin', 'hr_manager']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Employee Management</h1>
          <p className="text-muted-foreground">
            Manage employment, leaves, charges, and terminations
          </p>
        </div>
        <EmployeeList />
      </div>
    </ProtectedRoute>
  );
}
```

### 4. Create Employee Detail Page
Create `app/(dashboard)/employees/[id]/page.tsx`:

```typescript
'use client';

import { EmployeeDetail } from '@/components/admin/employee-detail';
import { ProtectedRoute } from '@/components/protected-route';
import { useParams } from 'next/navigation';

export default function EmployeeDetailPage() {
  const params = useParams();
  const employeeId = params.id as string;

  return (
    <ProtectedRoute requiredRoles={['admin', 'hr_manager']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Employee Details</h1>
        </div>
        <EmployeeDetail employeeId={employeeId} />
      </div>
    </ProtectedRoute>
  );
}
```

### 5. Create New Employee Page
Create `app/(dashboard)/employees/new/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function NewEmployeePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    position: '',
    department: '',
    salary: '',
    employmentDate: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: 'Success', description: 'Employee created successfully' });
        router.push(`/admin/employees/${data.data.id}`);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create employee', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Employee</CardTitle>
          <CardDescription>Add a new employee with employment details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Form fields... */}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Testing

### Test Creating an Employee
```bash
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "username": "john_doe",
    "password": "secure123",
    "firstName": "John",
    "lastName": "Doe",
    "employmentDate": "2024-01-15",
    "position": "Manager",
    "department": "Sales",
    "salary": "5000"
  }'
```

### Test Getting Employees
```bash
curl http://localhost:3000/api/employees?status=active&page=1
```

### Test Creating a Leave
```bash
curl -X POST http://localhost:3000/api/employees/[emp_id]/leaves \
  -H "Content-Type: application/json" \
  -d '{
    "leaveType": "vacation",
    "startDate": "2024-02-10",
    "endDate": "2024-02-15",
    "numberOfDays": 5
  }'
```

## Troubleshooting

### Issue: "Employment data not found"
- **Cause**: Employee exists but employment data wasn't created
- **Solution**: Create employment data via `POST /api/employees/[id]/employment`

### Issue: "Leave approval fails"
- **Cause**: Leave not found for this employee
- **Solution**: Verify leave ID and employee ID are correct

### Issue: "Cannot terminate already terminated employee"
- **Cause**: Employee already has a termination record
- **Solution**: Delete the termination first if you need to change it

## Next Steps

1. ✅ Implement Prisma schema changes
2. ✅ Create API endpoints
3. ✅ Build UI components
4. ⏳ **Create dashboard pages** - Add `/employees`, `/employees/[id]`, `/employees/new` pages
5. ⏳ **Add RBAC permissions** - Create permission records in database
6. ⏳ **Testing** - Test all endpoints and UI flows
7. ⏳ **Documentation** - Add to admin guide
8. ⏳ **Reporting** - Build reports dashboard for HR

## Files Modified

- ✅ `prisma/schema.prisma` - Added employment models
- ✅ `app/api/employees/route.ts` - List and create endpoints
- ✅ `app/api/employees/[id]/route.ts` - Detail endpoints
- ✅ `app/api/employees/[id]/employment/route.ts` - Employment data
- ✅ `app/api/employees/[id]/leaves/route.ts` - Leave management
- ✅ `app/api/employees/[id]/leaves/[leaveId]/route.ts` - Leave approval
- ✅ `app/api/employees/[id]/charges/route.ts` - Charges list
- ✅ `app/api/employees/[id]/charges/[chargeId]/route.ts` - Charge details
- ✅ `app/api/employees/[id]/termination/route.ts` - Termination
- ✅ `components/admin/employee-list.tsx` - Employee list UI
- ✅ `components/admin/employee-detail.tsx` - Employee details
- ✅ `components/admin/employee-employment-form.tsx` - Employment form
- ✅ `components/admin/employee-leaves-list.tsx` - Leaves management
- ✅ `components/admin/employee-charges-list.tsx` - Charges management
- ✅ `components/admin/employee-termination-form.tsx` - Termination form

## Documentation

See `EMPLOYEE_MANAGER_GUIDE.md` for comprehensive documentation including:
- Database schema details
- Complete API reference
- UI component descriptions
- Usage examples
- Permission requirements
- Future enhancements

---

**Status**: ✅ **COMPLETE**
All database models, API endpoints, and UI components have been implemented.
Ready for dashboard page creation, RBAC setup, and testing.
