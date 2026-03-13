'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { EmploymentForm } from './employee-employment-form';
import { EmployeeLeavesList } from './employee-leaves-list';
import { EmployeeChargesList } from './employee-charges-list';
import { EmployeeTerminationForm } from './employee-termination-form';

interface EmployeeDetailProps {
  employeeId: string;
}

export function EmployeeDetail({ employeeId }: EmployeeDetailProps) {
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/employees/${employeeId}`);
        const data = await response.json();

        if (data.success) {
          setEmployee(data.data);
        }
      } catch (error) {
        console.error('Failed to load employee:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEmployee();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!employee) {
    return <div className="text-center text-red-500">Employee not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">
                {employee.firstname} {employee.lastname}
              </CardTitle>
              <CardDescription>{employee.email}</CardDescription>
            </div>
            {employee.employment?.employmentStatus && (
              <Badge 
                variant={employee.employment.employmentStatus === 'active' ? 'default' : 'destructive'}
              >
                {employee.employment.employmentStatus}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Position</p>
              <p className="font-medium">{employee.employment?.position || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Department</p>
              <p className="font-medium">{employee.employment?.department || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Salary</p>
              <p className="font-medium">${employee.employment?.salary || '0'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Charges</p>
              <p className="font-medium text-orange-600">${employee.employment?.totalCharges || '0'}</p>
            </div>
          </div>

          {/* Salary Payment Flow */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3 text-sm">Salary Payment</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Salary Frequency</p>
                <p className="font-medium text-sm">{employee.employment?.salaryFrequency || 'Monthly'}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Last Payment</p>
                <p className="font-medium text-sm">{employee.employment?.lastPaymentDate ? new Date(employee.employment.lastPaymentDate).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Next Payment Due</p>
                <p className="font-medium text-sm">{employee.employment?.nextPaymentDate ? new Date(employee.employment.nextPaymentDate).toLocaleDateString() : 'Pending'}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Outstanding Charges</p>
                <p className="font-medium text-sm text-red-600">${employee.employment?.outstandingCharges || '0'}</p>
              </div>
            </div>
          </div>

          {/* Leave Summary */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3 text-sm">Leave Status</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Annual Leave Balance</p>
                <p className="font-medium text-sm">{employee.employment?.annualLeaveBalance || '0'} days</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Pending Leaves</p>
                <p className="font-medium text-sm">{employee.statistics?.pendingLeaves || '0'}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Approved Leaves</p>
                <p className="font-medium text-sm">{employee.statistics?.approvedLeaves || '0'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Total Leaves Used</p>
                <p className="font-medium text-sm">{employee.statistics?.totalLeavesUsed || '0'} days</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="employment" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
          <TabsTrigger value="charges">Charges</TabsTrigger>
          <TabsTrigger value="termination">Termination</TabsTrigger>
        </TabsList>

        <TabsContent value="employment">
          <EmploymentForm employeeId={employeeId} employment={employee.employment} />
        </TabsContent>

        <TabsContent value="leaves">
          <EmployeeLeavesList employeeId={employeeId} />
        </TabsContent>

        <TabsContent value="charges">
          <EmployeeChargesList employeeId={employeeId} />
        </TabsContent>

        <TabsContent value="termination">
          <EmployeeTerminationForm employeeId={employeeId} termination={employee.employment?.termination} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
