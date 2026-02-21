/**
 * Maintenance Request Card Component
 * Displays work order status with assign/log/verify actions
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MaintenanceStatus, MaintenancePriority } from '@prisma/client';

export interface MaintenanceRequestCardProps {
  request: {
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
  };
  onAssign?: (requestId: string) => void;
  onLogWork?: (requestId: string) => void;
  onComplete?: (requestId: string) => void;
  onVerify?: (requestId: string) => void;
  isLoading?: boolean;
}

const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  OPEN: 'bg-red-100 text-red-800',
  ASSIGNED: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ON_HOLD: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-green-100 text-green-800',
  VERIFIED: 'bg-green-200 text-green-900',
  CLOSED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  LOW: 'text-gray-600',
  NORMAL: 'text-blue-600',
  HIGH: 'text-orange-600',
  CRITICAL: 'text-red-600',
};

export function MaintenanceRequestCard({
  request,
  onAssign,
  onLogWork,
  onComplete,
  onVerify,
  isLoading = false,
}: MaintenanceRequestCardProps) {
  const canAssign = !request.assignedToId && request.status === 'OPEN';
  const canLogWork = request.assignedToId && ['ASSIGNED', 'IN_PROGRESS'].includes(request.status);
  const canComplete = request.status === 'IN_PROGRESS';
  const canVerify = request.status === 'COMPLETED';

  const daysAge = Math.floor(
    (new Date().getTime() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">WO #{request.workOrderNo}</CardTitle>
            <CardDescription>
              Room {request.unit.roomNumber} • {request.category} • Created {daysAge} days ago
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge className={STATUS_COLORS[request.status]}>
              {request.status.replace(/_/g, ' ')}
            </Badge>
            <Badge variant="outline" className={PRIORITY_COLORS[request.priority]}>
              {request.priority}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{request.description}</p>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {request.estimatedCostCents && (
            <div>
              <span className="text-muted-foreground">Est. Cost:</span>
              <span className="ml-2 font-medium">${(request.estimatedCostCents / 100).toFixed(2)}</span>
            </div>
          )}
          {request.actualCostCents && (
            <div>
              <span className="text-muted-foreground">Actual Cost:</span>
              <span className="ml-2 font-medium">${(request.actualCostCents / 100).toFixed(2)}</span>
            </div>
          )}
          {request.estimatedDays && (
            <div>
              <span className="text-muted-foreground">Est. Days:</span>
              <span className="ml-2 font-medium">{request.estimatedDays}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {canAssign && onAssign && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAssign(request.id)}
              disabled={isLoading}
            >
              Assign
            </Button>
          )}

          {canLogWork && onLogWork && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onLogWork(request.id)}
              disabled={isLoading}
            >
              Log Work
            </Button>
          )}

          {canComplete && onComplete && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onComplete(request.id)}
              disabled={isLoading}
            >
              Mark Complete
            </Button>
          )}

          {canVerify && onVerify && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onVerify(request.id)}
              disabled={isLoading}
            >
              Verify & Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
