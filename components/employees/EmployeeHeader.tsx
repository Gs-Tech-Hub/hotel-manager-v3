'use client';

import { ArrowLeft, LogIn, LogOut, Loader2 } from 'lucide-react';
import { EmployeeDetailData } from '../../hooks/useEmployee';

interface EmployeeHeaderProps {
  employee: EmployeeDetailData;
  activeCheckIn: any;
  monthlyCheckIns: number;
  monthlyCheckOuts: number;
  onCheckIn: () => Promise<void>;
  onCheckOut: () => Promise<void>;
  loading: boolean;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  on_leave: 'bg-blue-100 text-blue-800',
  terminated: 'bg-red-100 text-red-800',
};

export function EmployeeHeader({
  employee,
  activeCheckIn,
  monthlyCheckIns,
  monthlyCheckOuts,
  onCheckIn,
  onCheckOut,
  loading,
}: EmployeeHeaderProps) {
  const fullName = [employee.firstname, employee.lastname].filter(Boolean).join(' ') || employee.username;
  const empStatus = employee.employmentData?.employmentStatus || 'inactive';
  const statusColor = statusColors[empStatus] || statusColors.inactive;

  const handleCheckInClick = async () => {
    try {
      await onCheckIn();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleCheckOutClick = async () => {
    try {
      await onCheckOut();
    } catch (err) {
      // Error handled in hook
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">{fullName}</h1>
          <p className="text-gray-600 mt-2">{employee.email}</p>
          <p className="text-gray-600">@{employee.username}</p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColor}`}>
            {empStatus.replace('_', ' ').charAt(0).toUpperCase() + empStatus.slice(1).replace('_', ' ')}
          </span>
          {employee.blocked && (
            <span className="px-4 py-2 rounded-full text-sm font-medium bg-red-100 text-red-800">
              Blocked
            </span>
          )}
          <div className="flex gap-2 mt-2">
            {activeCheckIn ? (
              <button
                onClick={handleCheckOutClick}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking out...
                  </>
                ) : (
                  <>
                    <LogOut size={16} />
                    Clock Out
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleCheckInClick}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking in...
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    Clock In
                  </>
                )}
              </button>
            )}
          </div>
          <div className="flex gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1">
              <LogIn size={14} className="text-green-600" />
              <span className="font-semibold text-gray-900">{monthlyCheckIns}</span>
              <span className="text-gray-600">days</span>
            </div>
            <div className="flex items-center gap-1">
              <LogOut size={14} className="text-amber-600" />
              <span className="font-semibold text-gray-900">{monthlyCheckOuts}</span>
              <span className="text-gray-600">checkouts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
