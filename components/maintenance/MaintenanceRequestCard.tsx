/**
 * Maintenance Request Card Component
 * Displays work order status with assign/log/verify actions
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MaintenanceStatus, MaintenancePriority } from '@prisma/client';
import { formatTablePrice } from '@/lib/formatters';

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
  const canLogWork = ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(request.status); // Can log work without assignment
  const canComplete = request.status === 'IN_PROGRESS';
  const canVerify = request.status === 'COMPLETED';

  const daysAge = Math.floor(
    (new Date().getTime() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Create a human-readable request name
  const requestName = `${request.category.charAt(0).toUpperCase() + request.category.slice(1)} - Room ${request.unit.roomNumber}`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div>
            <CardTitle className="text-lg">{requestName}</CardTitle>
            <CardDescription>
              WO #{request.workOrderNo} • Created {daysAge} days ago
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
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
              <span className="ml-2 font-medium">{formatTablePrice(request.estimatedCostCents)}</span>
            </div>
          )}
          {request.actualCostCents && (
            <div>
              <span className="text-muted-foreground">Actual Cost:</span>
              <span className="ml-2 font-medium">{formatTablePrice(request.actualCostCents)}</span>
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
