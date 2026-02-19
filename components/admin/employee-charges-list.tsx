'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmployeeChargesListProps {
  employeeId: string;
}

export function EmployeeChargesList({ employeeId }: EmployeeChargesListProps) {
  const { toast } = useToast();
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [formData, setFormData] = useState({
    chargeType: 'debt',
    amount: '',
    description: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
  });

  const loadCharges = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/employees/${employeeId}/charges`);
      const data = await response.json();

      if (data.success) {
        setCharges(data.data.charges || []);
        setStats(data.data.statistics || {});
      }
    } catch (error) {
      console.error('Failed to load charges:', error);
      toast({ title: 'Error', description: 'Failed to load charges', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharges();
  }, [employeeId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Clean up empty optional fields before sending
      const cleanData = {
        ...formData,
        description: formData.description || undefined,
        reason: formData.reason || undefined,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
      };

      const response = await fetch(`/api/employees/${employeeId}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData),
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: 'Success', description: 'Charge added' });
        setFormData({
          chargeType: 'debt',
          amount: '',
          description: '',
          reason: '',
          date: new Date().toISOString().split('T')[0],
          dueDate: '',
        });
        setShowForm(false);
        loadCharges();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add charge', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCharge = async (chargeId: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      await fetch(`/api/employees/${employeeId}/charges/${chargeId}`, {
        method: 'DELETE',
      });
      toast({ title: 'Success', description: 'Charge deleted' });
      loadCharges();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete charge', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      paid: 'default',
      partially_paid: 'secondary',
      waived: 'secondary',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Charges & Debts</CardTitle>
            <CardDescription>Track employee charges, fines, and debts</CardDescription>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="sm" disabled={submitting}>
            <Plus className="mr-2 h-4 w-4" />
            New Charge
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-muted rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Total Amount</p>
              <p className="font-semibold">${stats.totalAmount || '0'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="font-semibold text-green-600">${stats.totalPaid || '0'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="font-semibold text-orange-600">{stats.pending || '0'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Partially Paid</p>
              <p className="font-semibold text-yellow-600">{stats.partiallyPaid || '0'}</p>
            </div>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-muted">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="chargeType">Charge Type</Label>
                <select
                  id="chargeType"
                  name="chargeType"
                  value={formData.chargeType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="debt">Debt</option>
                  <option value="fine">Fine</option>
                  <option value="shortage">Shortage</option>
                  <option value="advance">Advance</option>
                  <option value="loan">Loan</option>
                </select>
              </div>
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={handleChange}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Charge description"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="reason">Reason</Label>
                <Input
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  placeholder="Reason for charge"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  'Add Charge'
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : charges.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No charges</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {charges.map((charge) => (
                <TableRow key={charge.id}>
                  <TableCell className="font-medium">{charge.chargeType}</TableCell>
                  <TableCell>${charge.amount}</TableCell>
                  <TableCell>${charge.paidAmount}</TableCell>
                  <TableCell>{new Date(charge.date).toLocaleDateString()}</TableCell>
                  <TableCell>{getStatusBadge(charge.status)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteCharge(charge.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
