'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

interface TaxCollection {
  orderNumber: string;
  orderDate: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentStatus: string;
}

export function TaxCollectionsReport() {
  const [collections, setCollections] = useState<TaxCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalTaxCollected, setTotalTaxCollected] = useState(0);

  // Set default date range (current month)
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  // Fetch tax collections
  const fetchCollections = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/admin/tax-collections?${params.toString()}`);
      const data = await response.json();

      if (data.success && data.data?.collections) {
        setCollections(data.data.collections);
        setTotalTaxCollected(data.data.totalTaxCollected || 0);
      } else {
        toast.error(data.message || 'Failed to fetch tax collections');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch tax collections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchCollections();
    }
  }, [startDate, endDate]);

  const formatCurrency = (amount: number) => {
    return (amount / 100).toLocaleString('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    });
  };

  const handleExport = () => {
    // CSV export
    const headers = ['Order Number', 'Date', 'Subtotal', 'Tax Rate', 'Tax Amount', 'Total', 'Payment Status'];
    const rows = collections.map(c => [
      c.orderNumber,
      new Date(c.orderDate).toLocaleDateString(),
      (c.subtotal / 100).toFixed(2),
      `${c.taxRate}%`,
      (c.taxAmount / 100).toFixed(2),
      (c.total / 100).toFixed(2),
      c.paymentStatus,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-collections-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium">Tax Collections Report</h3>
        <p className="text-sm text-muted-foreground">
          Track all tax collected from orders based on the configured tax rate
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Collections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={fetchCollections} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Apply Filters'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Tax Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalTaxCollected)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              from {collections.length} orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Tax per Order</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(collections.length > 0 ? totalTaxCollected / collections.length : 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              per order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Paid Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {collections.filter(c => c.paymentStatus === 'paid').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of {collections.length} orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Collections Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Collections Details</CardTitle>
            <CardDescription>Breakdown of tax collected per order</CardDescription>
          </div>
          <Button
            onClick={handleExport}
            disabled={collections.length === 0}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No tax collections found for the selected date range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Tax Rate</TableHead>
                    <TableHead className="text-right">Tax Amount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collections.map((collection, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{collection.orderNumber}</TableCell>
                      <TableCell>{new Date(collection.orderDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(collection.subtotal)}</TableCell>
                      <TableCell className="text-right">{collection.taxRate}%</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(collection.taxAmount)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(collection.total)}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          collection.paymentStatus === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {collection.paymentStatus}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
