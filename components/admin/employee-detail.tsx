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
        <CardContent>
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
              <p className="text-sm text-muted-foreground">Total Debt</p>
              <p className="font-medium text-red-600">${employee.statistics?.totalDebt || '0'}</p>
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
