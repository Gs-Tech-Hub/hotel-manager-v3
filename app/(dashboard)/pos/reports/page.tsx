"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
} from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { Spinner } from "@/components/shared/spinner";

interface ReportData {
  metrics: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    totalItems: number;
    completedOrders: number;
    fulfillmentRate: number;
  };
  ordersByStatus: Record<string, number>;
  ordersByPaymentMethod: Record<string, { count: number; total: number }>;
  ordersByDepartment: Record<string, { count: number; total: number }>;
  ordersByHour: Record<number, { count: number; total: number }>;
  filters: {
    startDate: string | null;
    endDate: string | null;
    departmentCode: string | null;
    paymentMethod: string | null;
    orderStatus: string | null;
  };
}

export default function PosReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportData | null>(null);

  // Filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [departments, setDepartments] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  // Initialize date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    setEndDate(today.toISOString().split("T")[0]);
    setStartDate(thirtyDaysAgo.toISOString().split("T")[0]);
  }, []);

  // Fetch departments and payment methods
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [deptsRes, paymentsRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/payment-types"),
        ]);

        if (deptsRes.ok) {
          const deptsData = await deptsRes.json();
          const deptsList = Array.isArray(deptsData.data) ? deptsData.data : [];
          setDepartments(deptsList);
        }

        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          const paymentsList = Array.isArray(paymentsData.data) ? paymentsData.data : [];
          setPaymentMethods(paymentsList);
        }
      } catch (err) {
        console.error("Failed to fetch metadata:", err);
        setDepartments([]);
        setPaymentMethods([]);
      }
    };

    fetchMetadata();
  }, []);

  // Auto-fetch report when date range is set
  useEffect(() => {
    if (startDate && endDate) {
      const timer = setTimeout(() => {
        fetchReportData();
      }, 300); // Debounce to prevent excessive requests
      return () => clearTimeout(timer);
    }
  }, [startDate, endDate]);

  // Fetch report data
  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (departmentCode) params.append("departmentCode", departmentCode);
      if (paymentMethod) params.append("paymentMethod", paymentMethod);
      if (orderStatus) params.append("orderStatus", orderStatus);

      const response = await fetch(`/api/reports/pos?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || "Failed to fetch report data"
        );
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Report fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (startDate && endDate) {
      fetchReportData();
    }
  }, []);

  // Prepare hourly chart data
  const hourlyChartData = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      orders: data.ordersByHour[i]?.count || 0,
      revenue: Math.round((data.ordersByHour[i]?.total || 0) / 100),
    }));
  }, [data]);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Not authenticated. Please log in.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight">POS Reports</h1>
        <p className="text-muted-foreground mt-2">
          Analyze sales, revenue, and order metrics
          {startDate && endDate && (
            <span className="ml-2 inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
              {new Date(startDate + "T00:00:00").toLocaleDateString()} to{" "}
              {new Date(endDate + "T23:59:59").toLocaleDateString()}
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
              {startDate && (
                <p className="text-xs text-muted-foreground">
                  {new Date(startDate + "T00:00:00").toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
              {endDate && (
                <p className="text-xs text-muted-foreground">
                  {new Date(endDate + "T23:59:59").toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select value={departmentCode} onValueChange={setDepartmentCode}>
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.code}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="All methods" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.type}>
                      {method.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Order Status</label>
              <Select value={orderStatus} onValueChange={setOrderStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4 border-t pt-4">
            <p className="text-sm text-muted-foreground mr-auto">Quick date ranges:</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const today = new Date();
                const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                setStartDate(yesterday.toISOString().split("T")[0]);
                setEndDate(today.toISOString().split("T")[0]);
              }}
            >
              Last 24h
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const today = new Date();
                const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                setStartDate(sevenDaysAgo.toISOString().split("T")[0]);
                setEndDate(today.toISOString().split("T")[0]);
              }}
            >
              Last 7 Days
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const today = new Date();
                const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                setStartDate(thirtyDaysAgo.toISOString().split("T")[0]);
                setEndDate(today.toISOString().split("T")[0]);
              }}
            >
              Last 30 Days
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const today = new Date();
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                setStartDate(monthStart.toISOString().split("T")[0]);
                setEndDate(monthEnd.toISOString().split("T")[0]);
              }}
            >
              This Month
            </Button>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDepartmentCode("");
                setPaymentMethod("");
                setOrderStatus("");
              }}
            >
              Clear Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                setStartDate(thirtyDaysAgo.toISOString().split("T")[0]);
                setEndDate(today.toISOString().split("T")[0]);
                setDepartmentCode("");
                setPaymentMethod("");
                setOrderStatus("");
              }}
            >
              Reset All
            </Button>
            <Button variant="outline" size="sm" className="ml-auto">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : data ? (
        <Card>
          <CardHeader>
            <CardTitle>Complete Report Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* Key Metrics Table */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Key Metrics</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Detail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Total Orders</TableCell>
                        <TableCell className="text-right">{data.metrics.totalOrders}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {data.metrics.completedOrders} completed
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Total Revenue</TableCell>
                        <TableCell className="text-right">
                          ${(data.metrics.totalRevenue / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {data.metrics.totalOrders > 0
                            ? `$${(data.metrics.averageOrderValue / 100).toFixed(2)} avg`
                            : "No orders"}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Total Items</TableCell>
                        <TableCell className="text-right">{data.metrics.totalItems}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {data.metrics.totalOrders > 0
                            ? (data.metrics.totalItems / data.metrics.totalOrders).toFixed(1)
                            : "0"}{" "}
                          per order
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Fulfillment Rate</TableCell>
                        <TableCell className="text-right">{data.metrics.fulfillmentRate}%</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {data.metrics.completedOrders}/{data.metrics.totalOrders}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Order Status Distribution Table */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Order Status Distribution</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(data.ordersByStatus).map(([status, count]) => {
                        const percentage = data.metrics.totalOrders > 0 
                          ? Math.round((count / data.metrics.totalOrders) * 100)
                          : 0;
                        return (
                          <TableRow key={status}>
                            <TableCell className="font-medium capitalize">{status}</TableCell>
                            <TableCell className="text-right">{count}</TableCell>
                            <TableCell className="text-right">{percentage}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Payment Methods Distribution Table */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Payment Methods</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment Method</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                        <TableHead className="text-right">Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(data.ordersByPaymentMethod).map(
                        ([method, { count, total }]) => {
                          const percentage = data.metrics.totalOrders > 0 
                            ? Math.round((count / data.metrics.totalOrders) * 100)
                            : 0;
                          return (
                            <TableRow key={method}>
                              <TableCell className="font-medium capitalize">{method}</TableCell>
                              <TableCell className="text-right">{count}</TableCell>
                              <TableCell className="text-right">
                                ${(total / 100).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">{percentage}%</TableCell>
                            </TableRow>
                          );
                        }
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Department Performance Table */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Department Performance</h3>
                {Object.keys(data.ordersByDepartment).length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">Total Revenue</TableHead>
                          <TableHead className="text-right">Avg Order Value</TableHead>
                          <TableHead className="text-right">% of Total Orders</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(data.ordersByDepartment).map(
                          ([dept, { count, total }]) => {
                            const percentage = data.metrics.totalOrders > 0 
                              ? Math.round((count / data.metrics.totalOrders) * 100)
                              : 0;
                            return (
                              <TableRow key={dept}>
                                <TableCell className="font-medium">{dept}</TableCell>
                                <TableCell className="text-right">{count}</TableCell>
                                <TableCell className="text-right">
                                  ${(total / 100).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">
                                  ${(total / count / 100).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">{percentage}%</TableCell>
                              </TableRow>
                            );
                          }
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No department data available
                  </p>
                )}
              </div>

              {/* Hourly Distribution Table */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Hourly Order Distribution</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hour</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                        <TableHead className="text-right">Avg per Order</TableHead>
                        <TableHead className="text-right">% of Total Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hourData = data.ordersByHour[i];
                        if (!hourData || hourData.count === 0) return null;
                        const percentage = data.metrics.totalOrders > 0 
                          ? Math.round((hourData.count / data.metrics.totalOrders) * 100)
                          : 0;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {String(i).padStart(2, "0")}:00 - {String(i).padStart(2, "0")}:59
                            </TableCell>
                            <TableCell className="text-right">{hourData.count}</TableCell>
                            <TableCell className="text-right">
                              ${(hourData.total / 100).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              ${(hourData.total / hourData.count / 100).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">{percentage}%</TableCell>
                          </TableRow>
                        );
                      }).filter(Boolean)}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
