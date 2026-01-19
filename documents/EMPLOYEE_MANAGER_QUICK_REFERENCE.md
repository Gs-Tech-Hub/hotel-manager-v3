# Employee Manager - Quick Reference

## 🚀 30-Second Setup

```bash
# 1. Migrate database
npx prisma migrate dev --name add_employee_manager

# 2. Restart dev server
npm run dev

# 3. Test API
curl http://localhost:3000/api/employees
```

---

## 📖 Common Tasks

### Create an Employee
```typescript
await fetch('/api/employees', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    username: 'john_doe',
    password: 'secure123',
    firstName: 'John',
    lastName: 'Doe',
    employmentDate: '2024-01-15',
    position: 'Manager',
    department: 'Sales',
    salary: '5000',
  }),
});
```

### Get Employee List
```typescript
await fetch('/api/employees?status=active&page=1&limit=10');
```

### Get Employee Details
```typescript
await fetch('/api/employees/emp_123');
```

### Create Leave Request
```typescript
await fetch('/api/employees/emp_123/leaves', {
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

### Approve Leave
```typescript
await fetch('/api/employees/emp_123/leaves/leave_456', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'approved' }),
});
```

### Add Charge
```typescript
await fetch('/api/employees/emp_123/charges', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chargeType: 'fine',
    amount: '50',
    reason: 'Lateness',
    date: '2024-02-01',
  }),
});
```

### Record Payment
```typescript
await fetch('/api/employees/emp_123/charges/charge_456', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paidAmount: '50',
    status: 'paid',
    paymentDate: '2024-02-15',
  }),
});
```

### Terminate Employee
```typescript
await fetch('/api/employees/emp_123/termination', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    terminationDate: '2024-03-31',
    reason: 'resignation',
    finalSettlement: '10000',
  }),
});
```

---

## 📊 Database Models

### EmploymentData
```
id, userId
employmentDate, position, department
salary, salaryType, salaryFrequency
employmentStatus (active/inactive/on_leave/terminated)
contractType, reportsTo
terminationDate, terminationReason, terminationNotes
totalDebts, totalCharges
```

### EmployeeLeave
```
id, employmentDataId
leaveType, startDate, endDate, numberOfDays
reason, status (pending/approved/rejected/cancelled)
approvedBy, approvalDate, notes
```

### EmployeeCharge
```
id, employmentDataId
chargeType, amount, description, reason
date, dueDate
status (pending/paid/partially_paid/waived/cancelled)
paidAmount, paymentDate, paymentMethod, notes
```

### EmployeeTermination
```
id, employmentDataId
terminationDate, reason, details
finalSettlement, settlementStatus, settlementDate, notes
```

---

## 🎯 Status Values

### Employment Status
- `active` - Currently employed
- `inactive` - Inactive but not terminated
- `on_leave` - Currently on approved leave
- `terminated` - No longer employed

### Leave Status
- `pending` - Awaiting approval
- `approved` - Approved and confirmed
- `rejected` - Rejected by manager
- `cancelled` - Cancelled by employee

### Charge Status
- `pending` - Not yet paid
- `paid` - Fully paid
- `partially_paid` - Partially paid
- `waived` - Amount waived
- `cancelled` - Cancelled

### Settlement Status
- `pending` - Awaiting settlement
- `completed` - Settlement complete
- `disputed` - Under dispute

---

## 🔑 API Response Format

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error code",
  "message": "Error description"
}
```

### List Response
```json
{
  "success": true,
  "data": {
    "items": [ /* array of items */ ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "pages": 5
    }
  }
}
```

---

## 🛠️ Required Tools

- TypeScript
- Next.js 15
- Prisma ORM
- PostgreSQL (or compatible DB)
- React 19
- Tailwind CSS
- shadcn/ui

---

## 📁 Key Files

```
prisma/schema.prisma          # Database models
app/api/employees/route.ts    # Employee list/create
app/api/employees/[id]/route.ts        # Employee detail
app/api/employees/[id]/employment/    # Employment data
app/api/employees/[id]/leaves/        # Leave management
app/api/employees/[id]/charges/       # Charges/debts
app/api/employees/[id]/termination/   # Termination

components/admin/employee-list.tsx
components/admin/employee-detail.tsx
components/admin/employee-employment-form.tsx
components/admin/employee-leaves-list.tsx
components/admin/employee-charges-list.tsx
components/admin/employee-termination-form.tsx
```

---

## ⚠️ Error Codes

- `UNAUTHORIZED` (401) - Not authenticated
- `FORBIDDEN` (403) - Insufficient permissions
- `NOT_FOUND` (404) - Resource not found
- `BAD_REQUEST` (400) - Invalid request
- `CONFLICT` (409) - Conflict (e.g., duplicate email)
- `INTERNAL_ERROR` (500) - Server error

---

## 🎯 Permissions

Add to your RBAC system:
```
employees.view
employees.create
employees.edit
employees.delete
employees.employment.manage
employees.leaves.manage
employees.charges.manage
employees.termination.manage
```

---

## 💡 Tips

1. **Always include `Content-Type: application/json`** in POST/PUT requests
2. **Validate dates** before sending (format: YYYY-MM-DD)
3. **Use pagination** when fetching large employee lists
4. **Check error responses** for detailed error messages
5. **Track employee ID** when creating for later reference

---

## 🔗 Related Documentation

- See `EMPLOYEE_MANAGER_GUIDE.md` for comprehensive reference
- See `EMPLOYEE_MANAGER_IMPLEMENTATION.md` for setup instructions
- See `EMPLOYEE_MANAGER_SUMMARY.md` for complete feature overview

---

**Last Updated**: January 16, 2026
