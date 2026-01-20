'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Loader2, Plus, Search } from 'lucide-react';

interface Employee {
  id: string;
  email: string;
  username: string;
  firstname?: string;
  lastname?: string;
  employmentData?: {
    position: string;
    department?: string;
    employmentStatus: string;
    salary: number;
  };
  totalCharges: number;
  activeLeaves: number;
}

export function EmployeeList() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('page', page.toString());

      const response = await fetch(`/api/employees?${params}`);
      const data = await response.json();

      // console.log('[EmployeeList] API Response:', data);

      // Ensure we set employees to an array
      if (data.success && data.data) {
        const employeesList = data.data.employees;
        if (Array.isArray(employeesList)) {
          setEmployees(employeesList);
        } else {
          console.error('[EmployeeList] employees is not an array:', employeesList);
          setEmployees([]);
          setError('Invalid employee data format received');
        }
      } else {
        console.error('[EmployeeList] Response not successful:', data);
        setEmployees([]);
        setError(data.message || 'Failed to load employees');
      }
    } catch (error) {
      console.error('[EmployeeList] Failed to load employees:', error);
      setEmployees([]);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [status, page]);

  const filteredEmployees = Array.isArray(employees)
    ? employees.filter((emp) =>
        `${emp.firstname} ${emp.lastname} ${emp.email}`.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      inactive: 'secondary',
      on_leave: 'outline',
      terminated: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Employees</h2>
        <Button onClick={() => router.push('/admin/employees/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Management</CardTitle>
          <CardDescription>Track employment, leaves, charges, and terminations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-md bg-background text-sm"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On Leave</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : !Array.isArray(filteredEmployees) || filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No employees found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Charges</TableHead>
                  <TableHead>Leaves</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">
                      {emp.firstname} {emp.lastname}
                    </TableCell>
                    <TableCell>{emp.email}</TableCell>
                    <TableCell>{emp.employmentData?.position || '-'}</TableCell>
                    <TableCell>{emp.employmentData?.department || '-'}</TableCell>
                    <TableCell>
                      {emp.employmentData?.employmentStatus && 
                        getStatusBadge(emp.employmentData.employmentStatus)}
                    </TableCell>
                    <TableCell>{emp.totalCharges}</TableCell>
                    <TableCell>{emp.activeLeaves}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/employees/${emp.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
