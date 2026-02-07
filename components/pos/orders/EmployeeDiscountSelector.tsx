/**
 * Employee Targeting & Charge Option Component
 * 
 * On POS Terminal:
 * 1. Select an employee to target (optional - for discounts/charges)
 * 2. Apply any available discounts to the order
 * 3. Choose between:
 *    - "Charge to Employee" - charges to employee account, no payment needed
 *    - "Proceed to Payment" - normal payment checkout
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, User, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Employee {
  id: string;
  username: string;
  email: string;
  name: string;
  department?: string;
  position?: string;
  totalDebt: number;
  unpaidChargesCount: number;
}

interface EmployeeTargetingProps {
  orderTotal: number; // in dollars (calculated from cart)
  onEmployeeSelected?: (employee: Employee) => void;
  onCancel?: () => void;
  onChargeToEmployee?: (employeeId: string, amount: number) => Promise<void>;
  onProceedToPayment?: () => void;
  isSubmitting?: boolean;
}

export function EmployeeTargeting({
  orderTotal,
  onEmployeeSelected,
  onCancel,
  onChargeToEmployee,
  onProceedToPayment,
  isSubmitting = false,
}: EmployeeTargetingProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chargeMode, setChargeMode] = useState<'employee' | 'payment' | null>(null);

  // Fetch active employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/employees?status=active&limit=100');

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || 'Failed to load employees');
        }

        const data = await response.json();
        const empList = data.data?.employees || [];
        
        // Format employees for dropdown
        const formatted = empList.map((emp: any) => ({
          id: emp.id,
          username: emp.username,
          email: emp.email,
          name: `${emp.firstname || ''} ${emp.lastname || ''}`.trim() || emp.username,
          department: emp.employmentData?.department,
          position: emp.employmentData?.position,
          totalDebt: emp.totalCharges || 0,
          unpaidChargesCount: emp.employmentData?.charges?.length || 0,
        }));
        
        setEmployees(formatted);
      } catch (err) {
        console.error('Error loading employees:', err);
        setError(err instanceof Error ? err.message : 'Failed to load employees');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const selectedEmployeeData = employees.find((e) => e.id === selectedEmployee);

  const handleChargeClick = async () => {
    if (!selectedEmployee) {
      setError('Please select an employee');
      return;
    }

    try {
      setError(null);
      if (onChargeToEmployee) {
        await onChargeToEmployee(selectedEmployee, orderTotal);
      }
    } catch (err) {
      console.error('Error charging employee:', err);
      setError(err instanceof Error ? err.message : 'Failed to charge employee');
    }
  };

  const handlePaymentClick = () => {
    // Update selected employee data if one is selected
    if (selectedEmployeeData) {
      onEmployeeSelected?.(selectedEmployeeData);
    }
    onProceedToPayment?.();
  };

  // Show the charge mode selection if employee is selected
  if (chargeMode) {
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-lg">Complete Order</h3>
        </div>

        {/* Order Details */}
        <div className="p-3 bg-white rounded border space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Order Total:</span>
            <span className="text-lg font-bold text-gray-900">${orderTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center border-t pt-2">
            <span className="text-sm text-gray-600">Target Employee:</span>
            <span className="font-semibold">{selectedEmployeeData?.name}</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Info Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            Choose how to complete this order:
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2">
          <button
            onClick={handleChargeClick}
            disabled={isSubmitting}
            className="w-full p-3 rounded border-2 border-orange-400 bg-orange-50 hover:bg-orange-100 text-orange-900 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <span>💳 Charge to Employee Account</span>
                <p className="text-xs text-orange-700 mt-1">
                  Amount will be deducted from {selectedEmployeeData?.name}&apos;s salary
                </p>
              </>
            )}
          </button>

          <button
            onClick={handlePaymentClick}
            disabled={isSubmitting}
            className="w-full p-3 rounded border-2 border-green-400 bg-green-50 hover:bg-green-100 text-green-900 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
          >
            <span>💰 Proceed to Payment</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Back Button */}
        <button
          onClick={() => setChargeMode(null)}
          disabled={isSubmitting}
          className="w-full p-2 border rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Back
        </button>
      </div>
    );
  }

  // Show employee selection screen
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-slate-50">
      {/* Header */}
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-lg">Select Employee (Optional)</h3>
      </div>

      {/* Order Summary */}
      <div className="p-3 bg-white rounded border">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Order Total:</span>
          <span className="text-lg font-bold text-blue-600">${orderTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Info Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>Optional:</strong> Select an employee to target this order. You can apply any available discount and choose to charge their account or proceed to normal payment.
        </p>
      </div>

      {/* Employee Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Select Employee</label>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-4 text-red-600 bg-red-50 rounded">
            No active employees found
          </div>
        ) : (
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose an employee or skip..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  <div className="flex items-center gap-2">
                    <span>{emp.name}</span>
                    {emp.unpaidChargesCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {emp.unpaidChargesCount} unpaid
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Selected Employee Details */}
      {selectedEmployeeData && (
        <div className="p-3 bg-white rounded border space-y-1">
          <p className="text-sm">
            <strong>{selectedEmployeeData.name}</strong>
          </p>
          <p className="text-xs text-gray-600">{selectedEmployeeData.email}</p>
          {selectedEmployeeData.department && (
            <p className="text-xs text-gray-600">
              {selectedEmployeeData.position || 'Employee'} • {selectedEmployeeData.department}
            </p>
          )}
          {selectedEmployeeData.totalDebt > 0 && (
            <p className="text-xs font-medium text-orange-600">
              Existing debt: ${selectedEmployeeData.totalDebt.toFixed(2)}
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        {selectedEmployee ? (
          <>
            <button
              onClick={() => setChargeMode('employee')}
              disabled={!selectedEmployee}
              className="flex-1 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-50"
            >
              Continue
            </button>
            <button
              onClick={() => setSelectedEmployee('')}
              className="flex-1 p-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Change
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setChargeMode('payment')}
              className="flex-1 p-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
            >
              Skip & Proceed
            </button>
            <button
              onClick={onCancel}
              className="flex-1 p-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Export for backwards compatibility
export { EmployeeTargeting as EmployeeDiscountSelector };
