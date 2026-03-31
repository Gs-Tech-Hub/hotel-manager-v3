/**
 * useEmployee Hook
 * Manages single employee data fetching and state with improved error handling
 */

'use client';

import { useState, useEffect } from 'react';
import { employeeApi } from '../app/api/employees/employee.api';
import { EmployeeErrorType } from '@/lib/employee-error-handler';

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
  errorType?: EmployeeErrorType;
  errorDetail?: string;
  isRetryable?: boolean;
}

export function useEmployee(employeeId: string | undefined): UseEmployeeState {
  const [employee, setEmployee] = useState<EmployeeDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<EmployeeErrorType | undefined>();
  const [errorDetail, setErrorDetail] = useState<string | undefined>();
  const [isRetryable, setIsRetryable] = useState(false);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }

    const fetchEmployee = async () => {
      try {
        setLoading(true);
        setError(null);
        setErrorType(undefined);
        setErrorDetail(undefined);
        
        const data = await employeeApi.getById(employeeId);
        setEmployee(data);
        setIsRetryable(false);
      } catch (err: any) {
        console.error('Failed to load employee:', err);
        
        // Extract error details
        const message = err?.message || 'Failed to load employee';
        const type = err?.type as EmployeeErrorType | undefined;
        const detail = err?.detail;
        const statusCode = err?.statusCode;
        
        setError(message);
        setErrorType(type);
        setErrorDetail(detail);
        
        // Determine if error is retryable
        const retryable = 
          statusCode === 0 ||  // Network error
          statusCode === 408 || // Timeout
          statusCode === 429 || // Too many requests
          statusCode === 503 || // Service unavailable
          statusCode === 502 || // Bad gateway
          statusCode === 504;   // Gateway timeout
        
        setIsRetryable(retryable);
        setEmployee(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [employeeId]);

  return { employee, loading, error, errorType, errorDetail, isRetryable };
}
