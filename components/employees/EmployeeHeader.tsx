'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../auth-context';
import { ArrowLeft, LogIn, LogOut, Loader2, AlertCircle, Clock } from 'lucide-react';
import { EmployeeDetailData } from '../../hooks/useEmployee';

interface EmployeeHeaderProps {
  employee: EmployeeDetailData;
  activeCheckIn: any;
  monthlyCheckIns: number;
  monthlyCheckOuts: number;
  onCheckIn: () => Promise<void>;
  onCheckOut: () => Promise<void>;
  loading: boolean;
  dataLoading: boolean;
  error?: string | null;
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
  dataLoading,
  error,
}: EmployeeHeaderProps) {
  const [elapsedTime, setElapsedTime] = useState<string>('');
  const { user } = useAuth();

  // Debug: Log activeCheckIn state
  useEffect(() => {
    console.log('EmployeeHeader - activeCheckIn:', activeCheckIn);
    console.log('EmployeeHeader - dataLoading:', dataLoading);
  }, [activeCheckIn, dataLoading]);

  // Calculate elapsed time for active check-in
  useEffect(() => {
    if (!activeCheckIn?.checkInTime) {
      setElapsedTime('');
      return;
    }

    const updateElapsedTime = () => {
      const checkInTime = new Date(activeCheckIn.checkInTime);
      const now = new Date();
      const diffMs = now.getTime() - checkInTime.getTime();

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setElapsedTime(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateElapsedTime();
    const interval = setInterval(updateElapsedTime, 1000);

    return () => clearInterval(interval);
  }, [activeCheckIn]);

  const fullName = [employee.firstname, employee.lastname].filter(Boolean).join(' ') || employee.username;
  const empStatus = employee.employmentData?.employmentStatus || 'inactive';
  const statusColor = statusColors[empStatus] || statusColors.inactive;

  const handleCheckInClick = async () => {
    try {
      await onCheckIn();
    } catch (_err) {
      // Error handled in hook
    }
  };

  const handleCheckOutClick = async () => {
    try {
      await onCheckOut();
    } catch (_err) {
      // Error handled in hook
    }
  };

  return (
    <div className="space-y-4">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Action Required</h3>
            <p className="text-red-800 text-sm mt-1">{error}</p>
            {error.includes('already has active check-in') && (
              <p className="text-red-700 text-xs mt-2 font-medium">→ Please click &quot;Clock Out&quot; button to complete the current session first.</p>
            )}
          </div>
        </div>
      )}
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
          {/* Blocked status removed. Termination handled via admin-only action elsewhere. */}
          {user?.userType === 'admin' && (
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium mt-2"
              // TODO: Hook up to termination modal/flow
            >
              Terminate Employment
            </button>
          )}
          <div className="flex gap-2 mt-2">
            {dataLoading ? (
              <button
                disabled
                className="px-4 py-2 bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2 cursor-not-allowed"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </button>
            ) : activeCheckIn && activeCheckIn.checkInTime ? (
              <div className="flex flex-col gap-2">
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
                {elapsedTime && (
                  <div className="text-xs px-4 py-1 bg-amber-50 rounded border border-amber-200 text-amber-900 font-medium flex items-center gap-1">
                    <Clock size={14} />
                    Time worked: {elapsedTime}
                  </div>
                )}
              </div>
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
    </div>
  );
}
