/**
 * Employee API Service
 * Centralized API calls for employee-related operations
 */

import { extractResponseError, handleEmployeeDataError } from '@/lib/employee-error-handler';

export const employeeApi = {
  /**
   * Fetch single employee by ID
   * Provides detailed error information for debugging
   */
  getById: async (id: string) => {
    try {
      const res = await fetch(`/api/employees?limit=100`);
      
      if (!res.ok) {
        const errorCtx = await extractResponseError(res);
        const error = handleEmployeeDataError(errorCtx);
        // Re-throw with enhanced information
        const err = new Error(error.userMessage);
        (err as any).type = error.type;
        (err as any).statusCode = res.status;
        (err as any).detail = error.detail;
        throw err;
      }
      
      const json = await res.json();
      if (!json?.success) {
        const err = new Error(json?.error || 'Invalid response from server');
        (err as any).type = 'INVALID_RESPONSE';
        throw err;
      }
      
      const employees = json.data?.employees || [];
      const found = employees.find((emp: any) => emp.id === id);
      
      if (!found) {
        const err = new Error(`Employee with ID ${id} not found in the system`);
        (err as any).type = 'NOT_FOUND';
        throw err;
      }
      
      return found;
    } catch (error) {
      // Re-throw with context preserved
      throw error;
    }
  },

  /**
   * Check in employee
   */
  checkIn: async (employeeId: string) => {
    const res = await fetch('/api/employees/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId }),
    });

    if (!res.ok) throw new Error('Failed to check in');
    
    const json = await res.json();
    return json.data?.checkIn;
  },

  /**
   * Check out employee
   */
  checkOut: async (checkInId: string) => {
    const res = await fetch('/api/employees/attendance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkInId }),
    });

    if (!res.ok) throw new Error('Failed to check out');
    
    const json = await res.json();
    return json.data;
  },

  /**
   * Fetch monthly attendance
   */
  getMonthlyAttendance: async (employeeId: string, startDate: string, endDate: string) => {
    const res = await fetch(
      `/api/employees/attendance?employeeId=${employeeId}&fromDate=${startDate}&toDate=${endDate}`
    );

    if (!res.ok) throw new Error('Failed to fetch attendance');

    const json = await res.json();
    return json.data?.checkIns || [];
  },

  /**
   * Fetch consolidated salary data for employee
   * Includes employment, charges, attendance, and salary info
   */
  getSalary: async (id: string) => {
    try {
      const res = await fetch(`/api/employees/${id}/consolidated`);
      
      if (!res.ok) {
        const errorCtx = await extractResponseError(res);
        const error = handleEmployeeDataError(errorCtx);
        const err = new Error(error.userMessage);
        (err as any).type = error.type;
        (err as any).statusCode = res.status;
        (err as any).detail = error.detail;
        (err as any).suggestion = error.suggestion;
        throw err;
      }

      const json = await res.json();
      if (!json?.success && !json?.data) {
        throw new Error('Invalid response from server');
      }

      return json.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Process salary payment
   */
  paySalary: async (payload: {
    employeeId: string;
    amount: number;
    paymentMethod: string;
    notes: string;
  }) => {
    const res = await fetch('/api/employees/salary-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json();
      throw new Error(errJson?.message || 'Failed to process payment');
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Process early payout
   */
  earlyPayout: async (payload: {
    employeeId: string;
    amount: number;
    paymentMethod: string;
    notes: string;
  }) => {
    const res = await fetch('/api/employees/early-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json();
      throw new Error(errJson?.message || 'Failed to process early payout');
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Delete employee
   */
  delete: async (id: string) => {
    const res = await fetch(`/api/employees/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json?.error || `Failed to delete employee (${res.status})`);
    }

    return true;
  },
};
