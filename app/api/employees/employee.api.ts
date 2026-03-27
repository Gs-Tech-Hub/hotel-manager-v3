/**
 * Employee API Service
 * Centralized API calls for employee-related operations
 */

export const employeeApi = {
  /**
   * Fetch single employee by ID
   */
  getById: async (id: string) => {
    const res = await fetch(`/api/employees?limit=100`);
    if (!res.ok) throw new Error(`Failed to fetch employees (${res.status})`);
    
    const json = await res.json();
    if (!json?.success) throw new Error(json?.error || 'Invalid response');
    
    const employees = json.data?.employees || [];
    const found = employees.find((emp: any) => emp.id === id);
    
    if (!found) throw new Error('Employee not found');
    return found;
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
   * Fetch consolidated salary data
   */
  getSalary: async (id: string) => {
    const res = await fetch(`/api/employees/${id}/consolidated`);
    if (!res.ok) throw new Error('Failed to fetch salary data');

    const json = await res.json();
    return json.data;
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
