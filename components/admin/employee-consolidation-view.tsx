'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Clock, TrendingUp, Calendar, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { formatTablePrice } from '@/lib/formatters';
import { OutstandingChargesPayment } from '@/components/employees/OutstandingChargesPayment';

interface ConsolidatedEmployee {
  employee: {
    id: string;
    firstname?: string;
    lastname?: string;
    email: string;
    username: string;
  };
  employment: {
    position: string;
    department?: string;
    salary: number;
    salaryType: string;
    salaryFrequency: string;
    employmentStatus: string;
    employmentDate: string;
    terminationDate?: string;
    terminationReason?: string;
  };
  charges: {
    total: number;
    totalAmount: number;
    totalPaid: number;
    totalPending: number;
    currentMonth: {
      totalCharges: number;
      totalAmount: number;
      outstanding: number;
      paid: number;
      charges: Array<{
        id: string;
        chargeType: string;
        amount: number;
        paidAmount: number;
        status: string;
        date: string;
        description?: string;
      }>;
    };
    carryover: {
      totalCharges: number;
      totalAmount: number;
      outstanding: number;
      paid: number;
      charges: Array<{
        id: string;
        chargeType: string;
        amount: number;
        paidAmount: number;
        status: string;
        date: string;
        description?: string;
      }>;
    };
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    recent: Array<{
      id: string;
      chargeType: string;
      amount: number;
      paidAmount: number;
      status: string;
      date: string;
      description?: string;
    }>;
    unpaid: Array<{
      id: string;
      chargeType: string;
      amount: number;
      paidAmount: number;
      status: string;
      date: string;
      description?: string;
    }>;
  };
  salary: {
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    salaryDueDate: string;
    payEarly: boolean;
    chargeDetails: {
      pendingCharges: number;
      paidCharges: number;
      totalCharges: number;
    };
  } | null;
  salaryPeriods: Array<{
    periodStart: string;
    periodEnd: string;
    salaryDueDate: string;
    grossSalary: number;
    deductions: number;
    netSalary: number;
    status: string;
    paymentDate?: string;
    paymentId?: string;
    notes?: string;
  }>;
  salaryHistory: Array<{
    id: string;
    paymentDate: string;
    grossSalary: number;
    netSalary: number;
    status: string;
  }>;
  attendance: {
    totalDays: number;
    totalCheckIns: number;
    totalCheckOuts: number;
    totalHours: number;
    recent: Array<{
      id: string;
      checkInTime: string;
      checkOutTime?: string;
    }>;
  };
  summary: {
    status: string;
    position: string;
    baseSalary: number;
    totalChargesOutstanding: number;
    nextSalaryDue: string;
    attendancePercentage: number;
  };
}

interface EmployeeConsolidationViewProps {
  employeeId: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  on_leave: 'bg-blue-100 text-blue-800',
  terminated: 'bg-red-100 text-red-800',
};

const chargeStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  partially_paid: 'bg-orange-100 text-orange-800',
  waived: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function EmployeeConsolidationView({ employeeId }: EmployeeConsolidationViewProps) {
  const [data, setData] = useState<ConsolidatedEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [processingEarlyPayment, setProcessingEarlyPayment] = useState(false);
  const [processingSalaryDue, setProcessingSalaryDue] = useState<string | null>(null);
  const [showPayCharges, setShowPayCharges] = useState(false);

  useEffect(() => {
    fetchConsolidatedData();
  }, [employeeId]);

  const fetchConsolidatedData = async () => {
    try {
      setLoading(true);
      setError(null);
      setErrorDetail(null);
      
      const response = await fetch(`/api/employees/${employeeId}/consolidated`);

      if (!response.ok) {
        let errorMsg = `Failed to fetch employee data (${response.status})`;
        let detailMsg: string | null = null;

        try {
          const errorBody = await response.json();
          errorMsg = errorBody?.error || errorMsg;
          
          // Provide specific error messages based on status
          if (response.status === 401) {
            errorMsg = 'Your session has expired. Please log in again.';
          } else if (response.status === 403) {
            errorMsg = 'You do not have permission to view this employee\'s financial information.';
            detailMsg = 'Contact your administrator if you believe this is incorrect.';
          } else if (response.status === 404) {
            errorMsg = 'Employee or employment data not found.';
            detailMsg = 'The employee record may have been deleted or the employment information is incomplete.';
          } else if (response.status >= 500) {
            errorMsg = 'Server error while fetching employee data.';
            detailMsg = 'Please try again later or contact support.';
          }
        } catch (e) {
          // Response body parsing failed
        }

        throw new Error(errorMsg);
      }

      const result = await response.json();
      
      if (!result?.data) {
        throw new Error('Invalid response format from server');
      }

      setData(result.data);
      setError(null);
    } catch (err: any) {
      console.error('[EmployeeConsolidationView] Error:', err);
      const message = err.message || 'Failed to load employee details';
      setError(message);
      setErrorDetail(err?.detail || null);
      setData(null);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await fetchConsolidatedData();
  };

  const handleProcessSalaryPeriod = async (period: {
    periodStart: string;
    periodEnd: string;
    salaryDueDate: string;
    grossSalary: number;
    deductions: number;
    netSalary: number;
    status: string;
    paymentDate?: string;
    paymentId?: string;
    notes?: string;
  }) => {
    if (!data) return;

    try {
      setProcessingSalaryDue(period.salaryDueDate);
      setError(null);

      const periodNetSalary = period.netSalary > 0
        ? period.netSalary
        : Math.max(period.grossSalary - period.deductions, 0);

      const res = await fetch('/api/employees/salary-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: employeeId,
          paymentDate: new Date().toISOString(),
          grossSalary: period.grossSalary / 100,
          deductions: period.deductions / 100,
          netSalary: periodNetSalary / 100,
          paymentMethod: 'bank_transfer',
          status: 'completed',
          notes: `Back payment for period ${new Date(period.periodStart).toLocaleDateString()} - ${new Date(period.periodEnd).toLocaleDateString()}`,
          salaryDueDate: period.salaryDueDate,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json();
        throw new Error(errorBody?.error || 'Failed to process salary payment for period');
      }

      await fetchConsolidatedData();
    } catch (err: any) {
      console.error('[Pay Salary Period] Error:', err);
      setError(err.message || 'Unable to process salary period payment');
    } finally {
      setProcessingSalaryDue(null);
    }
  };

  const handleEarlyPayment = async () => {
    if (!data) return;

    try {
      setProcessingEarlyPayment(true);
      setError(null);

      const response = await fetch('/api/employees/early-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          paymentMethod: 'transfer',
          notes: 'Early salary payment via consolidation view',
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to process early payment';
        let detail: string | null = null;
        
        try {
          const errorBody = await response.json();
          errorMsg = errorBody?.error || errorMsg;
          
          if (response.status === 400) {
            detail = 'Please check the payment details and try again.';
          } else if (response.status === 403) {
            errorMsg = 'You do not have permission to process payments.';
          } else if (response.status === 409) {
            errorMsg = 'A payment is already being processed for this employee.';
            detail = 'Please wait and try again.';
          } else if (response.status >= 500) {
            errorMsg = 'Server error while processing payment.';
            detail = 'Please try again later.';
          }
        } catch (e) {
          // Response parsing failed
        }

        setError(errorMsg);
        setErrorDetail(detail);
        throw new Error(errorMsg);
      }

      // Refresh data
      await fetchConsolidatedData();
      // Show success message (you can use a toast here)
      setError(null);
    } catch (err: any) {
      console.error('[handleEarlyPayment] Error:', err);
      // Error already set above
    } finally {
      setProcessingEarlyPayment(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-48">
            <p className="text-gray-500">Loading employee details...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 text-base">Unable to Load Employee Details</h3>
              <p className="text-red-800 mt-2 text-sm">{error}</p>
              
              {errorDetail && (
                <p className="text-red-700 mt-2 text-xs italic">{errorDetail}</p>
              )}
              
              {/* Error context hints */}
              <div className="mt-3 p-3 bg-red-100 rounded border border-red-200 text-xs text-red-900 space-y-1">
                {error.includes('permission') && (
                  <>
                    <p>• You may not have access to financial data</p>
                    <p>• Check with your administrator for permission</p>
                  </>
                )}
                {error.includes('not found') && (
                  <>
                    <p>• The employee record may be incomplete</p>
                    <p>• Ensure all employment data is configured</p>
                  </>
                )}
                {error.includes('401') && (
                  <p>• Please log in again to continue</p>
                )}
                {error.includes('Server error') && (
                  <>
                    <p>• The server is experiencing issues</p>
                    <p>• Try again in a few moments</p>
                  </>
                )}
              </div>
              
              {/* Retry Button */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                  <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
                  {isRetrying ? 'Retrying...' : 'Try Again'}
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="flex gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <AlertCircle className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
        <p className="text-gray-700 text-sm">No employee data found</p>
      </div>
    );
  }

  const { charges, salaryHistory, salaryPeriods, attendance, summary } = data;
  const outstandingCharges = charges.totalPending > 0;

  return (
    <div className="space-y-6">
      
      {/* Outstanding Charges Warning */}
      {outstandingCharges && (
        <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-semibold text-sm">Outstanding Charges</p>
            <p className="text-red-700 text-sm">
              Amount due: {formatTablePrice(summary.totalChargesOutstanding)}
            </p>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="charges" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="charges">Charges</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Salary Tab - Hidden: Displayed in modal instead */}

        {/* Charges Tab */}
        <TabsContent value="charges">
          <Card>
            <CardHeader>
              <CardTitle>Charges Management</CardTitle>
              <CardDescription>Track all charges, debts, fines, and advances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Charge Summary - Current Month */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h5 className="font-semibold text-blue-900 mb-3">Current Month</h5>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-blue-600">Charges</p>
                      <p className="text-lg font-bold text-blue-900">{charges.currentMonth?.totalCharges ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600">Total</p>
                      <p className="text-lg font-bold text-blue-900">
                        {formatTablePrice((charges.currentMonth?.totalAmount ?? 0) * 100)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600">Outstanding</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatTablePrice((charges.currentMonth?.outstanding ?? 0) * 100)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600">Paid</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatTablePrice((charges.currentMonth?.paid ?? 0) * 100)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Charge Summary - Carryover */}
                {(charges.carryover?.totalCharges ?? 0) > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h5 className="font-semibold text-red-900 mb-3">Carryover (Previous Months)</h5>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-red-600">Charges</p>
                        <p className="text-lg font-bold text-red-900">{charges.carryover?.totalCharges ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-red-600">Total</p>
                        <p className="text-lg font-bold text-red-900">
                          {formatTablePrice((charges.carryover?.totalAmount ?? 0) * 100)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-red-600">Outstanding</p>
                        <p className="text-lg font-bold text-red-700">
                          {formatTablePrice((charges.carryover?.outstanding ?? 0) * 100)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-red-600">Paid</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatTablePrice((charges.carryover?.paid ?? 0) * 100)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Month Charges */}
                {charges.currentMonth?.charges && charges.currentMonth.charges.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3 text-blue-900">Current Month Charges</h4>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {charges.currentMonth.charges.map((charge) => (
                        <div
                          key={charge.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-blue-50"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{charge.chargeType}</p>
                            <p className="text-xs text-gray-500">
                              {charge.description || new Date(charge.date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right mr-3">
                            <p className="font-semibold">{formatTablePrice(Math.round(charge.amount * 100))}</p>
                            <p className="text-xs text-gray-500">
                              Paid: {formatTablePrice(Math.round(charge.paidAmount * 100))}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${chargeStatusColors[charge.status] || chargeStatusColors.pending}`}
                          >
                            {charge.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Carryover Charges (Previous Months - Unpaid) */}
                {charges.carryover?.charges && charges.carryover.charges.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3 text-red-900">Carryover Charges (Previous Months)</h4>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {charges.carryover.charges.map((charge) => (
                        <div
                          key={charge.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-red-50"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{charge.chargeType}</p>
                            <p className="text-xs text-gray-500">
                              {charge.description || new Date(charge.date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right mr-3">
                            <p className="font-semibold">{formatTablePrice(Math.round(charge.amount * 100))}</p>
                            <p className="text-xs text-gray-500">
                              Paid: {formatTablePrice(Math.round(charge.paidAmount * 100))}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${chargeStatusColors[charge.status] || chargeStatusColors.pending}`}
                          >
                            {charge.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Outstanding Charges Payment Section */}
              {charges.totalPending > 0 && (
                <div className="mt-6">
                  {!showPayCharges && (
                    <button
                      onClick={() => setShowPayCharges(true)}
                      className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                    >
                      Pay Now ({formatTablePrice(Math.round(charges.totalPending) * 100)})
                    </button>
                  )}
                  {showPayCharges && (
                    <OutstandingChargesPayment
                      employeeId={employeeId}
                      onPaymentSuccess={() => {
                        window.location.reload();
                      }}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Attendance Summary (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Days</p>
                  <p className="text-2xl font-bold text-blue-700">{attendance.totalDays}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Check-ins</p>
                  <p className="text-2xl font-bold text-green-700">{attendance.totalCheckIns}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600">Check-outs</p>
                  <p className="text-2xl font-bold text-orange-700">{attendance.totalCheckOuts}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Hours</p>
                  <p className="text-2xl font-bold text-purple-700">{attendance.totalHours.toFixed(1)}</p>
                </div>
              </div>

              {attendance.recent.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3">Recent Check-ins</h4>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {attendance.recent.map((record) => {
                      const checkInTime = new Date(record.checkInTime);
                      const checkOutTime = record.checkOutTime
                        ? new Date(record.checkOutTime)
                        : null;
                      const hours = checkOutTime
                        ? ((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2)
                        : 'ongoing';

                      return (
                        <div
                          key={record.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <p className="text-sm font-semibold">
                              {checkInTime.toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {checkInTime.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {checkOutTime
                                ? ` - ${checkOutTime.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}`
                                : ' - ongoing'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{hours} hrs</p>
                            {checkOutTime ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-orange-600" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Salary Payment History
              </CardTitle>
              <CardDescription>Recent salary payments and full schedule from employment start</CardDescription>
            </CardHeader>
            <CardContent>
              {salaryPeriods.length > 0 && (
                <div className="space-y-4 mb-6">
                  <h4 className="text-sm font-semibold">Salary Schedule</h4>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {salaryPeriods.slice(0, 8).map((period) => {
                      const dueDate = new Date(period.salaryDueDate);
                      const canPayPreviousMonth = period.status !== 'paid' && dueDate <= new Date();
                      const isProcessing = processingSalaryDue === period.salaryDueDate;

                      return (
                      <div
                        key={`${period.salaryDueDate}-${period.status}`}
                        className="flex flex-col gap-3 p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-semibold">
                              {new Date(period.periodStart).toLocaleDateString()} - {new Date(period.periodEnd).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              Due on {dueDate.toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">
                              {formatTablePrice(period.grossSalary)}
                            </p>
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded ${
                                period.status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : period.status === 'partial'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {period.status.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {canPayPreviousMonth && (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleProcessSalaryPeriod(period)}
                            className="self-start rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isProcessing ? 'Processing…' : 'Pay This Period'}
                          </button>
                        )}
                      </div>
                    );
                    })}
                  </div>
                </div>
              )}

              {salaryHistory.length > 0 ? (
                <div className="space-y-2">
                  {salaryHistory.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold">
                          {new Date(payment.paymentDate).toLocaleDateString()}
                        </p>
                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                          <span>Gross: {formatTablePrice(payment.grossSalary)}</span>
                          <span>Net: {formatTablePrice(payment.netSalary)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">
                          {formatTablePrice(payment.netSalary)}
                        </p>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${payment.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                        >
                          {payment.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No salary payments recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
