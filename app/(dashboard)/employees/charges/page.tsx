'use client';

import { EmployeeChargesGlobalList } from '@/components/admin/employee-charges-global-list';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};

interface Employee {
  id: string;
  firstname?: string;
  lastname?: string;
  email: string;
}

interface EmployeeCharge {
  id: string;
  employmentDataId: string;
  chargeType: string;
  amount: number;
  description?: string;
  reason?: string;
  date: string;
  dueDate?: string;
  status: 'pending' | 'paid' | 'partially_paid' | 'waived' | 'cancelled';
  paidAmount: number;
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
}

export default function EmployeeChargesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Employee Charges</h1>
        <p className="text-muted-foreground">Manage employee charges, fines, and deductions</p>
      </div>
      <EmployeeChargesGlobalList />
    </div>
  );
}
