'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, CheckCircle, Clock, XCircle } from 'lucide-react';
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

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};

const calculateDays = (start: string, end: string) => {
  if (!start || !end) return 0;
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
  } catch {
    return 0;
  }
};

interface EmployeeLeave {
  id: string;
  employmentDataId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  approvalDate?: string;
  notes?: string;
}

interface EmploymentData {
  id: string;
  userId: string;
  position: string;
  salary: number;
  user?: {
    firstname?: string;
    lastname?: string;
    email: string;
  };
}

export default function EmployeeLeavesPage() {
  const [leaves, setLeaves] = useState<EmployeeLeave[]>([]);
  const [employmentData, setEmploymentData] = useState<EmploymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingLeave, setEditingLeave] = useState<EmployeeLeave | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    numberOfDays: '1',
    reason: '',
    status: 'pending',
    notes: '',
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
        setEmploymentData(Array.isArray(empList) ? empList : []);
      }

      const leaveRes = await fetch('/api/employees/leaves');
      if (leaveRes.ok) {
        const leaveJson = await leaveRes.json();
        setLeaves(leaveJson.data?.leaves || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (leave?: EmployeeLeave) => {
    if (leave) {
      setEditingLeave(leave);
      setSelectedEmployee(leave.employmentDataId);
      setFormData({
        leaveType: leave.leaveType,
        startDate: new Date(leave.startDate).toISOString().split('T')[0],
        endDate: new Date(leave.endDate).toISOString().split('T')[0],
        numberOfDays: leave.numberOfDays.toString(),
        reason: leave.reason || '',
        status: leave.status,
        notes: leave.notes || '',
      });
    } else {
      setEditingLeave(null);
      setSelectedEmployee('');
      setFormData({
        leaveType: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        numberOfDays: '1',
        reason: '',
        status: 'pending',
        notes: '',
      });
    }
    setShowDialog(true);
  };

  const calculateDaysLocal = (start: string, end: string) => {
    if (!start || !end) return 0;
    try {
      const days = calculateDays(start, end);
      return Math.max(1, days);
    } catch {
      return 0;
    }
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newData = { ...formData, [field]: value };
    const days = calculateDaysLocal(newData.startDate, newData.endDate);
    setFormData({ ...newData, numberOfDays: days.toString() });
  };

  const handleSubmit = async () => {
    if (!selectedEmployee || !formData.leaveType || !formData.startDate || !formData.endDate) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const payload = {
        employmentDataId: selectedEmployee,
        leaveType: formData.leaveType,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        numberOfDays: parseInt(formData.numberOfDays),
        reason: formData.reason || null,
        status: formData.status,
        notes: formData.notes || null,
      };

      let res;
      if (editingLeave) {
        res = await fetch(`/api/employees/leaves/${editingLeave.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/employees/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error('Failed to save leave request');
      toast.success(editingLeave ? 'Leave updated' : 'Leave request created');
      setShowDialog(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving leave:', err);
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this leave request?')) return;

    try {
      const res = await fetch(`/api/employees/leaves/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Leave request deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getEmployeeName = (empDataId: string) => {
    const emp = employmentData.find((e) => e.id === empDataId);
    return emp?.user ? `${emp.user.firstname} ${emp.user.lastname}` : 'Unknown';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground">Manage employee leave requests and approvals</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          New Leave Request
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <CardDescription>All employee leave requests and approvals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No leave requests
                    </TableCell>
                  </TableRow>
                ) : (
                  leaves.map((leave) => (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium">
                        {getEmployeeName(leave.employmentDataId)}
                      </TableCell>
                      <TableCell>{leave.leaveType}</TableCell>
                      <TableCell>{formatDate(leave.startDate)}</TableCell>
                      <TableCell>{formatDate(leave.endDate)}</TableCell>
                      <TableCell className="text-center font-semibold">{leave.numberOfDays}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(leave.status)}
                          <span className="text-sm font-medium capitalize">{leave.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => handleOpenDialog(leave)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(leave.id)}>
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
              {editingLeave ? 'Update Leave Request' : 'Create New Leave Request'}
            </DialogTitle>
            <DialogDescription>
              {editingLeave ? 'Update leave details' : 'Create a new leave request for an employee'}
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
                  {employmentData.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.user?.firstname} {emp.user?.lastname} - {emp.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={formData.leaveType} onValueChange={(value) =>
                setFormData({ ...formData, leaveType: value })
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  <SelectItem value="maternity">Maternity</SelectItem>
                  <SelectItem value="paternity">Paternity</SelectItem>
                  <SelectItem value="bereavement">Bereavement</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Number of Days</Label>
              <Input
                type="number"
                value={formData.numberOfDays}
                onChange={(e) => setFormData({ ...formData, numberOfDays: e.target.value })}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Auto-calculated from dates</p>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Reason for leave"
              />
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
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
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
              {editingLeave ? 'Update' : 'Create'} Leave Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
