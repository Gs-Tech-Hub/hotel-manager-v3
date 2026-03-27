'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { EmployeeDetailData } from '../../hooks/useEmployee';
import { useSalary } from '../../hooks/useSalary';

interface SalaryModalProps {
  employee: EmployeeDetailData;
  onClose: () => void;
}

export function SalaryModal({ employee, onClose }: SalaryModalProps) {
  const { salaryData, loading, error, fetchSalary, paySalary, earlyPayout, clearError } = useSalary();
  const [payConfirmOpen, setPayConfirmOpen] = useState(false);
  const [payoutConfirmOpen, setPayoutConfirmOpen] = useState(false);

  useEffect(() => {
    fetchSalary(employee.id);
  }, [employee.id, fetchSalary]);

  const handlePaySalary = async () => {
    try {
      if (!salaryData?.currentSalary?.netSalary) {
        throw new Error('Unable to process payment: Missing salary data');
      }

      const notes = `Monthly salary payment for ${new Date().toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })}`;

      await paySalary(employee.id, salaryData.currentSalary.netSalary, notes);
      setPayConfirmOpen(false);
      // Refresh after payment
      await fetchSalary(employee.id);
    } catch (err: any) {
      console.error('Payment error:', err);
    }
  };

  const handleEarlyPayout = async () => {
    try {
      if (!salaryData?.currentSalary?.grossSalary) {
        throw new Error('Unable to process early payout: Missing salary data');
      }

      // Backend calculates eligible salary based on days worked
      const payoutAmount = Number(salaryData.currentSalary.grossSalary) * 0.5; // 50% advance

      const notes = `Early salary advance (50% of gross) for ${new Date().toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })}`;

      await earlyPayout(employee.id, payoutAmount, notes);
      setPayoutConfirmOpen(false);
      // Refresh after payout
      await fetchSalary(employee.id);
    } catch (err: any) {
      console.error('Early payout error:', err);
    }
  };

  const isSalaryDue =
    employee.nextSalaryDueDate && new Date() >= new Date(employee.nextSalaryDueDate);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Salary Calculation</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-red-900">Error</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="animate-spin mx-auto mb-4" size={32} />
              <p className="text-gray-600">Loading salary data...</p>
            </div>
          ) : salaryData?.currentSalary ? (
            <div className="space-y-6">
              {/* Salary Breakdown */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Current Month Breakdown</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">Gross Salary</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      ₦{Number(salaryData.currentSalary.grossSalary).toFixed(2)}
                    </p>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-600">Deductions</p>
                    <p className="text-2xl font-bold text-red-900 mt-2">
                      ₦{Number(salaryData.currentSalary.deductions || 0).toFixed(2)}
                    </p>
                  </div>

                  {salaryData.currentSalary.advances && (
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-sm text-orange-600">Advances</p>
                      <p className="text-2xl font-bold text-orange-900 mt-2">
                        ₦{Number(salaryData.currentSalary.advances).toFixed(2)}
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-600">Net Salary</p>
                    <p className="text-2xl font-bold text-green-900 mt-2">
                      ₦{Number(salaryData.currentSalary.netSalary).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Salary Data */}
              {Object.keys(salaryData).filter(key => key !== 'currentSalary').length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Additional Information</h3>
                  <div className="space-y-2">
                    {Object.entries(salaryData)
                      .filter(([key]) => key !== 'currentSalary')
                      .map(([key, value]) => (
                        <div
                          key={key}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200"
                        >
                          <span className="text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="font-semibold text-gray-900">
                            {typeof value === 'number'
                              ? `₦${Number(value).toFixed(2)}`
                              : String(value)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">No salary data available</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-end gap-3 flex-wrap">
          {/* Confirmation Dialogs */}
          {payConfirmOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Payment</h3>
                <p className="text-gray-600 mb-6">
                  Process salary payment of ₦
                  {salaryData?.currentSalary?.netSalary
                    ? Number(salaryData.currentSalary.netSalary).toFixed(2)
                    : '0.00'}{' '}
                  for {employee.firstname || employee.username}?
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setPayConfirmOpen(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePaySalary}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Confirm Payment'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {payoutConfirmOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Early Payout</h3>
                <p className="text-gray-600 mb-6">
                  Process early salary payout of ₦
                  {salaryData?.currentSalary?.grossSalary
                    ? (Number(salaryData.currentSalary.grossSalary) * 0.5).toFixed(2)
                    : '0.00'}{' '}
                  (50% advance) for {employee.firstname || employee.username}?
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setPayoutConfirmOpen(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEarlyPayout}
                    disabled={loading}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Confirm Payout'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Close
          </button>

          <button
            onClick={() => setPayConfirmOpen(true)}
            disabled={loading || !isSalaryDue}
            title={!isSalaryDue ? 'Salary is not due yet' : 'Process salary payment'}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign size={18} />
                Pay Salary
              </>
            )}
          </button>

          <button
            onClick={() => setPayoutConfirmOpen(true)}
            disabled={loading}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign size={18} />
                Early Payout
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
