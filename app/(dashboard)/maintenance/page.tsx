/**
 * Maintenance Request Management Dashboard
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MaintenanceRequestCard } from '@/components/maintenance/MaintenanceRequestCard';
import { MaintenanceStatus, MaintenancePriority } from '@prisma/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MaintenanceRequest {
  id: string;
  workOrderNo: string;
  unitId: string;
  unit: {
    roomNumber: string;
  };
  category: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assignedToId?: string;
  estimatedCostCents?: number;
  actualCostCents?: number;
  estimatedDays?: number;
  createdAt: Date;
}

export default function MaintenancePage() {
  const { user, hasAnyRole } = useAuth();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, priorityFilter]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);

      const response = await fetch(`/api/maintenance/requests?${params}`);
      if (!response.ok) throw new Error('Failed to fetch maintenance requests');
      const data = await response.json();
      setRequests(data.data?.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: string) => {
    try {
      const response = await fetch(`/api/maintenance/requests/${requestId}/${action}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to update request');
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (!hasAnyRole(['maintenance_tech', 'maintenance_manager', 'manager'])) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Access denied</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openCount = requests.filter((r) => r.status === 'OPEN').length;
  const inProgressCount = requests.filter((r) => r.status === 'IN_PROGRESS').length;
  const completedCount = requests.filter((r) => r.status === 'COMPLETED' || r.status === 'VERIFIED').length;
  const criticalCount = requests.filter((r) => r.priority === 'CRITICAL').length;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Maintenance Management</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              ⚠️ Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{criticalCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Maintenance Work Orders</CardTitle>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Priority</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No maintenance requests found.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {requests.map((request) => (
                <MaintenanceRequestCard
                  key={request.id}
                  request={request}
                  onLogWork={(id) => handleRequestAction(id, 'log')}
                  onComplete={(id) => handleRequestAction(id, 'complete')}
                  onVerify={(id) => handleRequestAction(id, 'verify')}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
