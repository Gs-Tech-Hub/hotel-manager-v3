/**
 * useAttendance Hook
 * Manages attendance/clock-in operations and monthly attendance data
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { employeeApi } from '../app/api/employees/employee.api';

export interface ClockInRecord {
  id: string;
  employeeId: string;
  checkInTime: string;
  checkOutTime?: string | null;
  daysCounted?: number;
}

interface UseAttendanceState {
  activeCheckIn: ClockInRecord | null;
  monthlyCheckIns: number;
  monthlyCheckOuts: number;
  clockInLoading: boolean;
  dataLoading: boolean;
  error: string | null;
  checkIn: () => Promise<void>;
  checkOut: () => Promise<void>;
  fetchMonthlyAttendance: () => Promise<void>;
}

export function useAttendance(employeeId: string | undefined): UseAttendanceState {
  const [activeCheckIn, setActiveCheckIn] = useState<ClockInRecord | null>(null);
  const [monthlyCheckIns, setMonthlyCheckIns] = useState(0);
  const [monthlyCheckOuts, setMonthlyCheckOuts] = useState(0);
  const [clockInLoading, setClockInLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMonthlyAttendance = useCallback(async () => {
    if (!employeeId) return;

    try {
      setDataLoading(true);
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const records = await employeeApi.getMonthlyAttendance(employeeId, startDate, endDate);
      console.log('useAttendance - Raw records from API:', records);

      let daysWorkedInMonth = 0;
      let completedCycles = 0;
      let hasActiveCheckIn = false;
      let activeCheckInRecord = null;

      for (const record of records) {
        console.log('useAttendance - Processing record:', record);
        if (record.checkOutTime) {
          daysWorkedInMonth += record.daysCounted || 1;
          completedCycles += 1;
        } else {
          console.log('useAttendance - Found active check-in:', record);
          hasActiveCheckIn = true;
          activeCheckInRecord = record;
        }
      }

      console.log('useAttendance - hasActiveCheckIn:', hasActiveCheckIn, 'activeCheckInRecord:', activeCheckInRecord);
      setMonthlyCheckIns(daysWorkedInMonth);
      setMonthlyCheckOuts(completedCycles);
      setActiveCheckIn(hasActiveCheckIn && activeCheckInRecord ? activeCheckInRecord : null);
    } catch (err: any) {
      console.error('Failed to fetch monthly attendance:', err);
      setError(err?.message || 'Failed to fetch attendance');
    } finally {
      setDataLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (employeeId) {
      fetchMonthlyAttendance();
    }
  }, [employeeId, fetchMonthlyAttendance]);

  const checkIn = useCallback(async () => {
    if (!employeeId) return;

    try {
      setClockInLoading(true);
      setError(null);
      const checkInData = await employeeApi.checkIn(employeeId);
      setActiveCheckIn(checkInData);
    } catch (err: any) {
      console.error('Check-in error:', err);
      setError(err?.message || 'Failed to check in');
      throw err;
    } finally {
      setClockInLoading(false);
    }
  }, [employeeId]);

  const checkOut = useCallback(async () => {
    if (!activeCheckIn) return;

    try {
      setClockInLoading(true);
      setError(null);
      await employeeApi.checkOut(activeCheckIn.id);
      setActiveCheckIn(null);
      // Refresh monthly attendance after checkout
      await fetchMonthlyAttendance();
    } catch (err: any) {
      console.error('Check-out error:', err);
      setError(err?.message || 'Failed to check out');
      throw err;
    } finally {
      setClockInLoading(false);
    }
  }, [activeCheckIn, fetchMonthlyAttendance]);

  return {
    activeCheckIn,
    monthlyCheckIns,
    monthlyCheckOuts,
    clockInLoading,
    dataLoading,
    error,
    checkIn,
    checkOut,
    fetchMonthlyAttendance,
  };
}
