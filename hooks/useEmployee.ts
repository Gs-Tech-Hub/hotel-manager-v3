/**
 * useEmployee Hook
 * Manages single employee data fetching and state
 */

'use client';

import { useState, useEffect } from 'react';
import { employeeApi } from '../app/api/employees/employee.api';

export interface EmployeeDetailData {
  id: string;
  email: string;
  username: string;
  firstname?: string;
  lastname?: string;
  blocked: boolean;
  employmentData?: {
    employmentDate: string;
    position: string;
    department?: string;
    salary: number;
    salaryType: string;
    salaryFrequency: string;
    employmentStatus: string;
    contractType?: string;
    reportsTo?: string;
    totalCharges?: number;
    totalDebts?: number;
  } | null;
  summary?: any;
  roles?: Array<{
    roleId: string;
    roleName: string;
    departmentId?: string;
    departmentName?: string;
  }>;
  totalCharges: number;
  totalOutstandingCharges: number;
  totalPaidCharges: number;
  chargesBreakdown: Record<string, { count: number; total: number }>;
  lastPaidDate?: string | null;
  nextSalaryDueDate?: string | null;
  activeLeaves: number;
  createdAt?: string;
}

interface UseEmployeeState {
  employee: EmployeeDetailData | null;
  loading: boolean;
  error: string | null;
}

export function useEmployee(employeeId: string | undefined): UseEmployeeState {
  const [employee, setEmployee] = useState<EmployeeDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) return;

    const fetchEmployee = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await employeeApi.getById(employeeId);
        setEmployee(data);
      } catch (err: any) {
        console.error('Failed to load employee:', err);
        setError(err?.message || 'Failed to load employee');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [employeeId]);

  return { employee, loading, error };
}
