'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Undo } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmployeeTerminationFormProps {
  employeeId: string;
  termination?: any;
}

export function EmployeeTerminationForm({
  employeeId,
  termination,
}: EmployeeTerminationFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showForm, setShowForm] = useState(!!termination);
  const [formData, setFormData] = useState({
    terminationDate: termination?.terminationDate?.split('T')[0] || '',
    reason: termination?.reason || '',
    details: termination?.details || '',
    finalSettlement: termination?.finalSettlement || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/employees/${employeeId}/termination`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: 'Success', description: 'Employee terminated' });
        setShowForm(true);
        window.location.reload();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to terminate employee', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('Are you sure you want to restore this employee?')) return;
    setRestoring(true);

    try {
      const response = await fetch(`/api/employees/${employeeId}/termination`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Employee restored' });
        window.location.reload();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to restore employee', variant: 'destructive' });
    } finally {
      setRestoring(false);
    }
  };

  if (showForm && termination) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Termination Record</CardTitle>
              <CardDescription>Employee termination details</CardDescription>
            </div>
            <Badge variant="destructive">Terminated</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Termination Date</Label>
              <p className="font-medium">
                {new Date(termination.terminationDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <Label>Reason</Label>
              <p className="font-medium">{termination.reason}</p>
            </div>
            <div className="md:col-span-2">
              <Label>Details</Label>
              <p className="font-medium text-sm">{termination.details || '-'}</p>
            </div>
            <div>
              <Label>Final Settlement</Label>
              <p className="font-medium">${termination.finalSettlement || '0'}</p>
            </div>
            <div>
              <Label>Settlement Status</Label>
              <Badge variant="secondary">{termination.settlementStatus}</Badge>
            </div>
          </div>

          <Button variant="outline" onClick={handleRestore} disabled={restoring}>
            {restoring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <Undo className="mr-2 h-4 w-4" />
                Restore Employee
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Termination</CardTitle>
        <CardDescription>Terminate employee and manage final settlement</CardDescription>
      </CardHeader>
      <CardContent>
        {!showForm ? (
          <Button onClick={() => setShowForm(true)} variant="destructive">
            Terminate Employee
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="terminationDate">Termination Date</Label>
                <Input
                  id="terminationDate"
                  name="terminationDate"
                  type="date"
                  value={formData.terminationDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <select
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange as any}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                  required
                >
                  <option value="">Select reason</option>
                  <option value="resignation">Resignation</option>
                  <option value="dismissal">Dismissal</option>
                  <option value="retirement">Retirement</option>
                  <option value="layoff">Layoff</option>
                  <option value="contract_end">Contract End</option>
                </select>
              </div>
              <div>
                <Label htmlFor="finalSettlement">Final Settlement Amount</Label>
                <Input
                  id="finalSettlement"
                  name="finalSettlement"
                  type="number"
                  step="0.01"
                  value={formData.finalSettlement}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="details">Details</Label>
              <textarea
                id="details"
                name="details"
                value={formData.details}
                onChange={handleChange}
                placeholder="Termination details..."
                className="w-full px-3 py-2 border rounded-md bg-background text-sm min-h-[100px]"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Terminate Employee
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
