'use client';

import { useState, useEffect } from 'react';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';
import { employeeApi } from '../../app/api/employees/employee.api';

interface AttendanceSectionProps {
  employeeId: string;
}

export interface ClockInRecord {
  id: string;
  checkInTime: string;
  checkOutTime?: string | null;
  daysCounted?: number;
}

export function AttendanceSection({ employeeId }: AttendanceSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [clockInDetails, setClockInDetails] = useState<ClockInRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleViewDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const records = await employeeApi.getMonthlyAttendance(employeeId, startDate, endDate);

      // Sort by check-in time descending (most recent first)
      const sorted = records.sort((a: any, b: any) => {
        return new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime();
      });

      setClockInDetails(sorted);
      setShowModal(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch clock-in details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Monthly Attendance</h2>
        <button
          onClick={handleViewDetails}
          disabled={loading}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <LogIn size={18} />
              Clock-in Details
            </>
          )}
        </button>
      </div>

      {showModal && (
        <ClockInModal
          clockInDetails={clockInDetails}
          loading={loading}
          error={error}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

interface ClockInModalProps {
  clockInDetails: ClockInRecord[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

const formatDateTime = (dateStr: string | undefined) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return 'N/A';
  }
};

const calculateDuration = (checkIn: string | undefined, checkOut: string | undefined) => {
  if (!checkIn || !checkOut) return 'N/A';
  try {
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHours}h ${diffMinutes}m`;
  } catch {
    return 'N/A';
  }
};

function ClockInModal({ clockInDetails, loading, error, onClose }: ClockInModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Clock-in Details</h2>
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
              <p className="text-gray-600">Loading clock-in details...</p>
            </div>
          ) : clockInDetails.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        Check-In Time
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        Check-Out Time
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {clockInDetails.map((record, idx) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDateTime(record.checkInTime)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {record.checkOutTime ? formatDateTime(record.checkOutTime) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {calculateDuration(record.checkInTime, record.checkOutTime || "")}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {record.checkOutTime ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                              Completed
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-medium">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <LogIn className="mx-auto text-gray-400 mb-3" size={32} />
              <p className="text-gray-600">No clock-in records for this month</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
