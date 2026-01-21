'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmploymentFormProps {
  employeeId: string;
  employment?: any;
}

export function EmploymentForm({ employeeId, employment }: EmploymentFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employmentDate: employment?.employmentDate?.split('T')[0] || new Date().toISOString().split('T')[0],
    position: employment?.position || '',
    department: employment?.department || '',
    salary: employment?.salary || '',
    salaryType: employment?.salaryType || 'monthly',
    salaryFrequency: employment?.salaryFrequency || 'monthly',
    contractType: employment?.contractType || 'permanent',
    reportsTo: employment?.reportsTo || '',
    employmentStatus: employment?.employmentStatus || 'active',
    terminationDate: employment?.terminationDate?.split('T')[0] || '',
    terminationReason: employment?.terminationReason || '',
    terminationNotes: employment?.terminationNotes || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: 'Success', description: 'Employment data saved successfully' });
      } else {
        toast({ title: 'Error', description: data.message || 'Failed to save employment data', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({ title: 'Error', description: 'Failed to save employment data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employment Information</CardTitle>
        <CardDescription>Manage employment details, salary, and status</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Employment Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employmentDate">Employment Date *</Label>
                <Input
                  id="employmentDate"
                  name="employmentDate"
                  type="date"
                  value={formData.employmentDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="position">Position *</Label>
                <Input
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  placeholder="e.g., Server, Chef, Manager"
                  required
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="e.g., Restaurant, Kitchen, Bar"
                />
              </div>
              <div>
                <Label htmlFor="reportsTo">Reports To (Manager ID)</Label>
                <Input
                  id="reportsTo"
                  name="reportsTo"
                  value={formData.reportsTo}
                  onChange={handleChange}
                  placeholder="Manager's employee ID"
                />
              </div>
            </div>
          </div>

          {/* Salary Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Salary Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="salary">Salary Amount</Label>
                <Input
                  id="salary"
                  name="salary"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.salary}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="salaryType">Salary Type</Label>
                <select
                  id="salaryType"
                  name="salaryType"
                  value={formData.salaryType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="hourly">Hourly</option>
                  <option value="annual">Annual</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div>
                <Label htmlFor="salaryFrequency">Payment Frequency</Label>
                <select
                  id="salaryFrequency"
                  name="salaryFrequency"
                  value={formData.salaryFrequency}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div>
                <Label htmlFor="contractType">Contract Type</Label>
                <select
                  id="contractType"
                  name="contractType"
                  value={formData.contractType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="permanent">Permanent</option>
                  <option value="temporary">Temporary</option>
                  <option value="contractor">Contractor</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
            </div>
          </div>

          {/* Employment Status */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Employment Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employmentStatus">Status</Label>
                <select
                  id="employmentStatus"
                  name="employmentStatus"
                  value={formData.employmentStatus}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
              <div>
                <Label htmlFor="terminationDate">Termination Date</Label>
                <Input
                  id="terminationDate"
                  name="terminationDate"
                  type="date"
                  value={formData.terminationDate}
                  onChange={handleChange}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="terminationReason">Termination Reason</Label>
                <Input
                  id="terminationReason"
                  name="terminationReason"
                  value={formData.terminationReason}
                  onChange={handleChange}
                  placeholder="e.g., Resignation, Layoff, Retirement"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="terminationNotes">Termination Notes</Label>
                <textarea
                  id="terminationNotes"
                  name="terminationNotes"
                  value={formData.terminationNotes}
                  onChange={handleChange}
                  placeholder="Additional notes about termination..."
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Employment Data
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
