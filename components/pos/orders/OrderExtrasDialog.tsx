'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/price';

interface Extra {
  id: string;
  name: string;
  unit: string;
  price: number;
  description?: string;
}

interface SelectedExtra {
  extraId: string;
  quantity: number;
}

interface OrderExtrasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderHeaderId: string;
  orderLineId: string;
  departmentCode?: string;
  onSuccess?: () => void;
}

export function OrderExtrasDialog({
  open,
  onOpenChange,
  orderHeaderId,
  orderLineId,
  departmentCode,
  onSuccess,
}: OrderExtrasDialogProps) {
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<Map<string, SelectedExtra>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Fetch extras when dialog opens
  useEffect(() => {
    if (!open) return;

    const fetchExtras = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = departmentCode
          ? `/api/extras?department=${departmentCode}`
          : '/api/extras';

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch extras: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setExtras(data.data);
        }
      } catch (err) {
        console.error('Error fetching extras:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load extras'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchExtras();
  }, [open, departmentCode]);

  // Handle quantity change
  const handleQuantityChange = (extraId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedExtras((prev) => {
        const updated = new Map(prev);
        updated.delete(extraId);
        return updated;
      });
    } else {
      setSelectedExtras((prev) => {
        const updated = new Map(prev);
        updated.set(extraId, { extraId, quantity });
        return updated;
      });
    }
  };

  // Submit extras
  const handleSubmit = async () => {
    if (selectedExtras.size === 0) {
      setError('Please select at least one extra');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const extrasArray = Array.from(selectedExtras.values());

      const response = await fetch('/api/extras/order-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderHeaderId,
          orderLineId,
          extras: extrasArray,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message || 'Failed to add extras to order'
        );
      }

      // Success
      setSelectedExtras(new Map());
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error adding extras:', err);
      setError(err instanceof Error ? err.message : 'Failed to add extras');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate total
  const totalPrice = Array.from(selectedExtras.values()).reduce((sum, item) => {
    const extra = extras.find((e) => e.id === item.extraId);
    return sum + (extra ? extra.price * item.quantity : 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Extras to Order Line</DialogTitle>
          <DialogDescription>
            Select supplementary items to add to this order line
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        ) : extras.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No extras available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Extras List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {extras.map((extra) => {
                const selected = selectedExtras.get(extra.id);
                const quantity = selected?.quantity || 0;

                return (
                  <div
                    key={extra.id}
                    className="flex items-center gap-3 rounded-md border p-3 bg-white hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <label className="font-medium text-sm cursor-pointer">
                          {extra.name}
                        </label>
                        <Badge variant="outline" className="text-xs">
                          {extra.unit}
                        </Badge>
                      </div>
                      {extra.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {extra.description}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-amber-900 mt-1">
                        {formatPrice(extra.price / 100)} each
                      </p>
                    </div>

                    {/* Quantity Input */}
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="999"
                        value={quantity}
                        onChange={(e) =>
                          handleQuantityChange(
                            extra.id,
                            parseInt(e.target.value) || 0
                          )
                        }
                        disabled={submitting}
                        className="w-16 text-center"
                        placeholder="0"
                      />
                      {quantity > 0 && (
                        <span className="text-sm font-medium text-amber-900 whitespace-nowrap">
                          {formatPrice((extra.price * quantity) / 100)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            {selectedExtras.size > 0 && (
              <div className="border-t pt-3 mt-4">
                <div className="flex justify-between items-center font-semibold">
                  <span>Extras Total</span>
                  <span className="text-lg text-amber-900">
                    {formatPrice(totalPrice / 100)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting || loading || selectedExtras.size === 0 || extras.length === 0
            }
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              `Add ${selectedExtras.size} Extras`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
