'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCents } from '@/lib/price';

interface Extra {
  id: string;
  name: string;
  unit: string;
  price: number;
}

interface OrderExtraItem {
  id: string;
  orderLineId: string;
  extraId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  status: 'pending' | 'processing' | 'fulfilled' | 'cancelled';
  extra: Extra;
}

interface OrderLineExtrasProps {
  orderLineId: string;
  orderHeaderId: string;
  onExtrasChanged?: () => void;
}

export function OrderLineExtras({
  orderLineId,
  orderHeaderId,
  onExtrasChanged,
}: OrderLineExtrasProps) {
  const [extras, setExtras] = useState<OrderExtraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [extraToDelete, setExtraToDelete] = useState<string | null>(null);

  // Fetch extras for this order line
  useEffect(() => {
    const fetchExtras = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/orders/${orderHeaderId}/extras?orderLineId=${orderLineId}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch extras: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success && data.data) {
          // Filter for this specific order line
          const lineExtras = Array.isArray(data.data)
            ? data.data.filter((e: OrderExtraItem) => e.orderLineId === orderLineId)
            : [];
          setExtras(lineExtras);
        }
      } catch (error) {
        console.error('Error fetching extras:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExtras();
  }, [orderLineId, orderHeaderId]);

  // Handle removing/cancelling an extra
  const handleRemoveExtra = async (orderExtraId: string) => {
    try {
      setRemoving(orderExtraId);

      const response = await fetch(
        `/api/orders/${orderHeaderId}/extras/${orderExtraId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to cancel extra: ${response.statusText}`);
      }

      // Remove from local state
      setExtras((prev) =>
        prev.map((e) =>
          e.id === orderExtraId ? { ...e, status: 'cancelled' } : e
        )
      );

      console.log('Extra removed from order');

      onExtrasChanged?.();
    } catch (error) {
      console.error('Error removing extra:', error);
    } finally {
      setRemoving(null);
      setDeleteDialogOpen(false);
      setExtraToDelete(null);
    }
  };

  // Filter out cancelled extras for display
  const activeExtras = extras.filter((e) => e.status !== 'cancelled');
  const totalExtrasPrice = activeExtras.reduce((sum, e) => sum + e.lineTotal, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeExtras.length === 0) {
    return null;
  }

  return (
    <Card className="mt-3 bg-amber-50/50 border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900">
            {activeExtras.length}
          </span>
          Added Extras
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {/* Extras List */}
          {activeExtras.map((orderExtra) => (
            <div
              key={orderExtra.id}
              className="flex items-center justify-between rounded-md bg-white p-2.5 border border-amber-100"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1">
                  <span className="font-medium text-sm">
                    {orderExtra.extra.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({orderExtra.extra.unit})
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>Qty: {orderExtra.quantity}</span>
                  <span>×</span>
                  <span>{formatCents(orderExtra.unitPrice)}</span>
                  <span className="font-medium text-foreground">
                    = {formatCents(orderExtra.lineTotal)}
                  </span>
                </div>

                {/* Status Badge */}
                <div className="mt-1">
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      orderExtra.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : orderExtra.status === 'processing'
                        ? 'bg-blue-100 text-blue-800'
                        : orderExtra.status === 'fulfilled'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {orderExtra.status.charAt(0).toUpperCase() +
                      orderExtra.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Remove Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setExtraToDelete(orderExtra.id);
                  setDeleteDialogOpen(true);
                }}
                disabled={removing === orderExtra.id}
                className="ml-2 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
              >
                {removing === orderExtra.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}

          {/* Total */}
          <div className="border-t border-amber-200 pt-2 mt-3">
            <div className="flex justify-between items-center font-semibold">
              <span>Extras Subtotal</span>
              <span className="text-amber-900">
                {formatCents(totalExtrasPrice)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Remove Extra from Order?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the extra from the order line. This action can be
            undone by adding it again.
          </p>
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Keep Extra
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (extraToDelete) {
                  handleRemoveExtra(extraToDelete);
                }
              }}
            >
              Remove Extra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
