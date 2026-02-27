/**
 * Cleaning Task Management Dashboard
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CleaningTaskCard } from '@/components/cleaning/CleaningTaskCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CleaningTask {
  id: string;
  taskNumber: string;
  unitId: string;
  unit: {
    roomNumber: string;
  };
  priority: string;
  status: string;
  taskType: string;
  assignedToId?: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
}

export default function CleaningPage() {
  const { user, hasAnyRole } = useAuth();
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    fetchTasks();
    // Refresh tasks every 30 seconds to show active tasks
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [statusFilter, priorityFilter]);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);

      const response = await fetch(`/api/cleaning/tasks?${params}`);
      if (!response.ok) throw new Error('Failed to fetch cleaning tasks');
      const data = await response.json();
      setTasks(data.data?.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskAction = async (taskId: string, action: string, approved?: boolean) => {
    try {
      const body: Record<string, any> = {};
      
      // For inspect action, include approval status
      if (action === 'inspect') {
        body.approved = approved === true;
      }
      
      const response = await fetch(`/api/cleaning/tasks/${taskId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update task');
      }
      
      setError(null);
      await fetchTasks();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMsg);
      console.error(`Error performing ${action} action:`, err);
    }
  };

  if (!hasAnyRole(['admin', 'housekeeping', 'housekeeping_supervisor', 'manager'])) {
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

  const pendingCount = tasks.filter((t) => t.status === 'PENDING').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const awaitingInspection = tasks.filter((t) => t.status === 'COMPLETED').length;
  const inspectedCount = tasks.filter((t) => t.status === 'INSPECTED').length;
  const activeTasks = tasks.filter((t) => t.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Cleaning Management</h1>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Awaiting Inspection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{awaitingInspection}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inspected ✓
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{inspectedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cleaning Tasks</CardTitle>
            <div className="flex gap-2">
              <Select value={statusFilter || 'all'} onValueChange={(val) => setStatusFilter(val === 'all' ? '' : val)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="INSPECTED">Inspected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter || 'all'} onValueChange={(val) => setPriorityFilter(val === 'all' ? '' : val)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
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
          ) : tasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No cleaning tasks found.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tasks.map((task) => {
                // Custom handler for inspect to allow approve/reject
                const handleInspect = (id: string) => {
                  const approved = confirm('Approve this cleaning task? The room will become available for booking if approved.');
                  handleTaskAction(id, 'inspect', approved);
                };
                
                return (
                  <CleaningTaskCard
                    key={task.id}
                    task={task as any}
                    onStart={(id) => handleTaskAction(id, 'start')}
                    onComplete={(id) => handleTaskAction(id, 'complete')}
                    onInspect={handleInspect}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
