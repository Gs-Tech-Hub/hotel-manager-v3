'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  Clock,
  TrendingUp,
  Calendar,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
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
  const [processingEarlyPayment, setProcessingEarlyPayment] = useState(false);
  const [showPayCharges, setShowPayCharges] = useState(false);

  useEffect(() => {
    fetchConsolidatedData();
  }, [employeeId]);

  const fetchConsolidatedData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/employees/${employeeId}/consolidated`);

      if (!response.ok) {
        throw new Error('Failed to fetch employee data');
      }

      const result = await response.json();
      // The endpoint returns data directly, not nested under "employee"
      setData(result.data || null);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEarlyPayment = async () => {
    if (!data) return;

    try {
      setProcessingEarlyPayment(true);

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
        throw new Error('Failed to process early payment');
      }

      // Refresh data
      await fetchConsolidatedData();
      // Show success message (you can use a toast here)
    } catch (err: any) {
      setError(err.message);
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
      <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-800 font-semibold text-sm">Error</p>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
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

  const { charges, salaryHistory, attendance, summary } = data;
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
                {/* Charge Summary */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Charges</p>
                    <p className="text-2xl font-bold">{charges.total}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="text-2xl font-bold text-red-700">
                      {formatTablePrice(charges.totalAmount * 100)}
                    </p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-gray-600">Outstanding</p>
                    <p className="text-2xl font-bold text-yellow-700">
                      {formatTablePrice(Math.round(charges.totalPending) * 100)}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Paid</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatTablePrice(Math.round(charges.totalPaid) * 100)}
                    </p>
                  </div>
                </div>

                {/* Charges by Status */}
                {charges.recent.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3">Recent Charges (Last 30 Days)</h4>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {charges.recent
                        .filter((charge) => {
                          // Only show paid charges from the last 30 days
                          if (charge.status === 'paid') {
                            const chargeDate = new Date(charge.date);
                            const thirtyDaysAgo = new Date();
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            return chargeDate >= thirtyDaysAgo;
                          }
                          return true;
                        })
                        .map((charge) => (
                        <div
                          key={charge.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
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
              <CardDescription>Last 5 salary payments</CardDescription>
            </CardHeader>
            <CardContent>
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
