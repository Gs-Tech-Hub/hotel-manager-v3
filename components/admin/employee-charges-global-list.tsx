'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { formatTablePrice } from '@/lib/formatters';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

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

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};

export function EmployeeChargesGlobalList() {
  const [charges, setCharges] = useState<EmployeeCharge[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCharge, setEditingCharge] = useState<EmployeeCharge | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [formData, setFormData] = useState({
    chargeType: '',
    amount: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    status: 'pending',
    paidAmount: '0',
    paymentMethod: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const empRes = await fetch('/api/employees');
      if (empRes.ok) {
        const empJson = await empRes.json();
        const empList = empJson.data?.employees || empJson.data || [];
        setEmployees(Array.isArray(empList) ? empList : []);
      }

      const chargeRes = await fetch('/api/employees/charges');
      if (chargeRes.ok) {
        const chargeJson = await chargeRes.json();
        setCharges(chargeJson.data?.charges || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (charge?: EmployeeCharge) => {
    if (charge) {
      setEditingCharge(charge);
      setSelectedEmployee(charge.employmentDataId);
      setFormData({
        chargeType: charge.chargeType,
        amount: charge.amount.toString(),
        reason: charge.reason || '',
        date: new Date(charge.date).toISOString().split('T')[0],
        dueDate: charge.dueDate ? new Date(charge.dueDate).toISOString().split('T')[0] : '',
        status: charge.status,
        paidAmount: charge.paidAmount.toString(),
        paymentMethod: charge.paymentMethod || '',
      });
    } else {
      setEditingCharge(null);
      setSelectedEmployee('');
      setFormData({
        chargeType: '',
        amount: '',
        reason: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: '',
        status: 'pending',
        paidAmount: '0',
        paymentMethod: '',
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedEmployee || !formData.chargeType || !formData.amount) {
      toast.error('Please fill required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        userId: selectedEmployee,
        chargeType: formData.chargeType,
        amount: parseFloat(formData.amount),
        reason: formData.reason || null,
        date: new Date(formData.date).toISOString(),
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        status: formData.status,
        paidAmount: parseFloat(formData.paidAmount),
        paymentMethod: formData.paymentMethod || null,
      };

      let res;
      if (editingCharge) {
        res = await fetch(`/api/employees/charges/${editingCharge.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/employees/charges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error('Failed to save charge');
      toast.success(editingCharge ? 'Charge updated' : 'Charge created');
      setShowDialog(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving charge:', err);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this charge?')) return;

    try {
      const res = await fetch(`/api/employees/charges/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Charge deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getEmployeeName = (userId: string) => {
    const emp = employees.find((e) => e.id === userId);
    return emp ? `${emp.firstname} ${emp.lastname}` : 'Unknown';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'partially_paid':
        return 'text-blue-600';
      case 'waived':
        return 'text-gray-600';
      case 'cancelled':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Charge Records</h2>
          <p className="text-muted-foreground">All employee charges and deductions</p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={submitting}>
          <Plus className="mr-2 h-4 w-4" />
          Add Charge
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No charges recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  charges.map((charge) => (
                    <TableRow key={charge.id}>
                      <TableCell className="font-medium">{getEmployeeName(charge.employmentDataId)}</TableCell>
                      <TableCell>{charge.chargeType}</TableCell>
                      <TableCell>{formatTablePrice(Number(charge.amount) * 100)}</TableCell>
                      <TableCell>{formatTablePrice(Number(charge.paidAmount) * 100)}</TableCell>
                      <TableCell>{formatDate(charge.date)}</TableCell>
                      <TableCell>
                        {charge.dueDate ? formatDate(charge.dueDate) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium capitalize ${getStatusColor(charge.status)}`}>
                          {charge.status.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => handleOpenDialog(charge)} disabled={submitting}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(charge.id)} disabled={submitting}>
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
            <DialogTitle>{editingCharge ? 'Update Charge' : 'Add New Charge'}</DialogTitle>
            <DialogDescription>
              {editingCharge ? 'Update the charge details' : 'Record a new employee charge or deduction'}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Charge Type</Label>
                <Input
                  value={formData.chargeType}
                  onChange={(e) => setFormData({ ...formData, chargeType: e.target.value })}
                  placeholder="e.g., Fine, Shortage, Advance"
                />
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Reason for charge"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Charge Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) =>
                  setFormData({ ...formData, status: value as any })
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                    <SelectItem value="waived">Waived</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Paid Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.paidAmount}
                  onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Input
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                placeholder="e.g., Cash, Deduction from Salary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {editingCharge ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  {editingCharge ? 'Update' : 'Create'} Charge
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
