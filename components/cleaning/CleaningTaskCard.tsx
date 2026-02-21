/**
 * Cleaning Task Card Component
 * Displays task status with assign/start/complete actions
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CleaningPriority, CleaningTaskStatus } from '@prisma/client';

export interface CleaningTaskCardProps {
  task: {
    id: string;
    taskNumber: string;
    unitId: string;
    unit: {
      roomNumber: string;
    };
    priority: CleaningPriority;
    status: CleaningTaskStatus;
    taskType: string;
    assignedToId?: string;
    startedAt?: Date;
    completedAt?: Date;
    notes?: string;
  };
  onAssign?: (taskId: string) => void;
  onStart?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onInspect?: (taskId: string) => void;
  isLoading?: boolean;
}

const STATUS_COLORS: Record<CleaningTaskStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  INSPECTED: 'bg-green-200 text-green-900',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<CleaningPriority, string> = {
  LOW: 'text-gray-600',
  NORMAL: 'text-blue-600',
  HIGH: 'text-orange-600',
  URGENT: 'text-red-600',
};

export function CleaningTaskCard({
  task,
  onAssign,
  onStart,
  onComplete,
  onInspect,
  isLoading = false,
}: CleaningTaskCardProps) {
  const canAssign = !task.assignedToId && task.status === 'PENDING';
  const canStart = task.assignedToId && task.status === 'PENDING';
  const canComplete = task.status === 'IN_PROGRESS';
  const canInspect = task.status === 'COMPLETED';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Task {task.taskNumber}</CardTitle>
            <CardDescription>
              Room {task.unit.roomNumber} • {task.taskType.replace(/_/g, ' ')}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge className={STATUS_COLORS[task.status]}>
              {task.status.replace(/_/g, ' ')}
            </Badge>
            <Badge variant="outline" className={PRIORITY_COLORS[task.priority]}>
              {task.priority}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {task.notes && (
          <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
            {task.notes}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {canAssign && onAssign && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAssign(task.id)}
              disabled={isLoading}
            >
              Assign
            </Button>
          )}

          {canStart && onStart && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onStart(task.id)}
              disabled={isLoading}
            >
              Start
            </Button>
          )}

          {canComplete && onComplete && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onComplete(task.id)}
              disabled={isLoading}
            >
              Mark Complete
            </Button>
          )}

          {canInspect && onInspect && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onInspect(task.id)}
              disabled={isLoading}
            >
              Inspect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
