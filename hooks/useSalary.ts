/**
 * useSalary Hook
 * Manages salary data fetching and payment operations
 */

'use client';

import { useState, useCallback } from 'react';
import { employeeApi } from '../app/api/employees/employee.api';

export interface SalaryData {
  currentSalary?: {
    grossSalary: number;
    netSalary: number;
    deductions: number;
    advances?: number;
  };
  [key: string]: any;
}

interface UseSalaryState {
  salaryData: SalaryData | null;
  loading: boolean;
  error: string | null;
  fetchSalary: (employeeId: string) => Promise<void>;
  paySalary: (employeeId: string, amount: number, notes: string) => Promise<void>;
  earlyPayout: (employeeId: string, amount: number, notes: string) => Promise<void>;
  clearError: () => void;
}

export function useSalary(): UseSalaryState {
  const [salaryData, setSalaryData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSalary = useCallback(async (employeeId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await employeeApi.getSalary(employeeId);
      setSalaryData(data);
    } catch (err: any) {
      const message = err?.message || 'Failed to fetch salary data';
      console.error('Salary fetch error:', err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const paySalary = useCallback(
    async (employeeId: string, amount: number, notes: string) => {
      try {
        setLoading(true);
        setError(null);
        await employeeApi.paySalary({
          employeeId,
          amount,
          paymentMethod: 'bank_transfer',
          notes,
        });
        // Refresh salary data after payment
        await fetchSalary(employeeId);
      } catch (err: any) {
        const message = err?.message || 'Failed to process payment';
        console.error('Payment error:', err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchSalary]
  );

  const earlyPayout = useCallback(
    async (employeeId: string, amount: number, notes: string) => {
      try {
        setLoading(true);
        setError(null);
        await employeeApi.earlyPayout({
          employeeId,
          amount,
          paymentMethod: 'bank_transfer',
          notes,
        });
        // Refresh salary data after payout
        await fetchSalary(employeeId);
      } catch (err: any) {
        const message = err?.message || 'Failed to process early payout';
        console.error('Early payout error:', err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchSalary]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    salaryData,
    loading,
    error,
    fetchSalary,
    paySalary,
    earlyPayout,
    clearError,
  };
}
