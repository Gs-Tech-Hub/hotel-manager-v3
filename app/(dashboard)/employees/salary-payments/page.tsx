'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};

const isSalaryOverdue = (salaryDueDate?: string): boolean => {
  if (!salaryDueDate) return false;
  const dueDate = new Date(salaryDueDate);
  const today = new Date();
  return dueDate < today;
};

const getDaysUntilDue = (salaryDueDate?: string): number => {
  if (!salaryDueDate) return 0;
  const dueDate = new Date(salaryDueDate);
  const today = new Date();
  const diffTime = dueDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

interface SalaryPayment {
  id: string;
  userId: string;
  paymentDate: string;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  paymentMethod?: string;
  status: 'pending' | 'completed' | 'failed';
  notes?: string;
  salaryDueDate?: string;
}

interface Employee {
  id: string;
  firstname?: string;
  lastname?: string;
  email: string;
  employmentData?: any;
}

export default function SalaryPaymentsPage() {
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SalaryPayment | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [formData, setFormData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    grossSalary: '',
    deductions: '0',
    netSalary: '',
    paymentMethod: '',
    status: 'completed',
    notes: '',
  });

  // Fetch employees and payments
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch employees
      const empRes = await fetch('/api/employees');
      if (empRes.ok) {
        const empJson = await empRes.json();
        const empList = empJson.data?.employees || empJson.data || [];
        setEmployees(Array.isArray(empList) ? empList : []);
      }

      // Fetch salary payments
      const payRes = await fetch('/api/employees/salary-payments');
      if (payRes.ok) {
        const payJson = await payRes.json();
        setPayments(payJson.data?.payments || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (payment?: SalaryPayment) => {
    if (payment) {
      setEditingPayment(payment);
      setSelectedEmployee(payment.userId);
      setFormData({
        paymentDate: new Date(payment.paymentDate).toISOString().split('T')[0],
        grossSalary: payment.grossSalary.toString(),
        deductions: payment.deductions.toString(),
        netSalary: payment.netSalary.toString(),
        paymentMethod: payment.paymentMethod || '',
        status: payment.status,
        notes: payment.notes || '',
      });
    } else {
      setEditingPayment(null);
      setSelectedEmployee('');
      setFormData({
        paymentDate: new Date().toISOString().split('T')[0],
        grossSalary: '',
        deductions: '0',
        netSalary: '',
        paymentMethod: '',
        status: 'completed',
        notes: '',
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedEmployee || !formData.grossSalary || !formData.netSalary) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const payload = {
        userId: selectedEmployee,
        paymentDate: new Date(formData.paymentDate).toISOString(),
        grossSalary: parseFloat(formData.grossSalary),
        deductions: parseFloat(formData.deductions),
        netSalary: parseFloat(formData.netSalary),
        paymentMethod: formData.paymentMethod || null,
        status: formData.status,
        notes: formData.notes || null,
      };

      let res;
      if (editingPayment) {
        res = await fetch(`/api/employees/salary-payments/${editingPayment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/employees/salary-payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        throw new Error(`Failed to save payment`);
      }

      toast.success(editingPayment ? 'Payment updated' : 'Payment created');
      setShowDialog(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving payment:', err);
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment record?')) return;

    try {
      const res = await fetch(`/api/employees/salary-payments/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Payment deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getEmployeeName = (userId: string) => {
    const emp = employees.find((e) => e.id === userId);
    return emp ? `${emp.firstname} ${emp.lastname}` : 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Salary Payments</h1>
          <p className="text-muted-foreground">Manage and track employee salary payments</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </div>

      {/* Salary Due Notifications */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Overdue Salaries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {payments.filter((p) => isSalaryOverdue(p.salaryDueDate)).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Salaries past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Due Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {payments.filter((p) => !isSalaryOverdue(p.salaryDueDate) && getDaysUntilDue(p.salaryDueDate) > 0 && getDaysUntilDue(p.salaryDueDate) <= 3).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Due within 3 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {payments.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Records in system</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>All recorded salary payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Salary Due Date</TableHead>
                  <TableHead>Gross Salary</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No salary payments recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{getEmployeeName(payment.userId)}</TableCell>
                      <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                      <TableCell>
                        {payment.salaryDueDate ? (
                          <div className="flex items-center gap-2">
                            <span>{formatDate(payment.salaryDueDate)}</span>
                            {isSalaryOverdue(payment.salaryDueDate) && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                Overdue
                              </span>
                            )}
                            {!isSalaryOverdue(payment.salaryDueDate) && getDaysUntilDue(payment.salaryDueDate) <= 3 && (
                              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                                Due Soon
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>${payment.grossSalary.toFixed(2)}</TableCell>
                      <TableCell>${payment.deductions.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">${payment.netSalary.toFixed(2)}</TableCell>
                      <TableCell>{payment.paymentMethod || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {payment.status === 'completed' ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium">Paid</span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4 text-yellow-600" />
                              <span className="text-sm font-medium capitalize">{payment.status}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenDialog(payment)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(payment.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPayment ? 'Update Payment' : 'Record Salary Payment'}
            </DialogTitle>
            <DialogDescription>
              {editingPayment
                ? 'Update the payment details'
                : 'Record a new salary payment for an employee'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstname} {emp.lastname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gross Salary</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.grossSalary}
                  onChange={(e) => setFormData({ ...formData, grossSalary: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Deductions</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.deductions}
                  onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Net Salary</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.netSalary}
                onChange={(e) => setFormData({ ...formData, netSalary: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Input
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  placeholder="e.g., Cash, Bank Transfer"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) => 
                  setFormData({ ...formData, status: value })
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingPayment ? 'Update' : 'Create'} Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
