'use client';

import { useState } from 'react';
import { DollarSign, Loader2 } from 'lucide-react';
import { EmployeeDetailData } from '../../hooks/useEmployee';
import { SalaryModal } from './SalaryModal';

interface SalarySectionProps {
  employee: EmployeeDetailData;
  onViewDetails: () => Promise<void>;
  loading: boolean;
}

const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return 'N/A';
  }
};

export function SalarySection({ employee, onViewDetails, loading }: SalarySectionProps) {
  const [showModal, setShowModal] = useState(false);

  const handleViewSalary = async () => {
    try {
      await onViewDetails();
      setShowModal(true);
    } catch (err) {
      // Error handled in hook
    }
  };

  const daysUntilDue = employee.nextSalaryDueDate
    ? Math.ceil((new Date(employee.nextSalaryDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isDueSoon = daysUntilDue !== null && daysUntilDue <= 7;

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Salary & Payment</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <p className="text-sm font-medium text-blue-700 uppercase">Last Paid</p>
            <p className="text-2xl font-bold text-blue-900 mt-3">
              {formatDate(employee.lastPaidDate)}
            </p>
            <p className="text-sm text-blue-700 mt-2">Last salary payment date</p>
          </div>

          <div
            className={`rounded-lg p-6 border-2 ${
              isDueSoon ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
            }`}
          >
            <p
              className={`text-sm font-medium uppercase ${
                isDueSoon ? 'text-yellow-700' : 'text-green-700'
              }`}
            >
              Next Salary Due
            </p>
            <p
              className={`text-2xl font-bold mt-3 ${
                isDueSoon ? 'text-yellow-900' : 'text-green-900'
              }`}
            >
              {formatDate(employee.nextSalaryDueDate)}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6 flex-wrap">
          <button
            onClick={handleViewSalary}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <DollarSign size={18} />
                View Salary Calculation
              </>
            )}
          </button>
        </div>
      </div>

      {showModal && (
        <SalaryModal
          employee={employee}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
