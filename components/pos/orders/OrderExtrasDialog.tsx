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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { formatCents } from '@/lib/price';

interface DepartmentExtra {
  id: string;
  departmentId: string;
  sectionId?: string;
  extraId: string;
  quantity: number;
  reserved: number;
}

interface Extra {
  id: string;
  name: string;
  unit: string;
  price: number;
  description?: string;
  productId?: string;
  trackInventory?: boolean;
  product?: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
  };
  departmentExtras?: DepartmentExtra[];
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
  sectionId?: string;
  onSuccess?: () => void;
}

export function OrderExtrasDialog({
  open,
  onOpenChange,
  orderHeaderId,
  orderLineId,
  departmentCode,
  sectionId,
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
        if (data.success && data.data?.extras && Array.isArray(data.data.extras)) {
          // Filter extras by section if sectionId is provided
          const filteredExtras = sectionId
            ? (data.data.extras as Extra[]).filter((extra) => {
                // Keep extras that have a department allocation for this section
                return (
                  extra.departmentExtras &&
                  extra.departmentExtras.some((dept) => dept.sectionId === sectionId)
                );
              })
            : (data.data.extras as Extra[]);
          
          setExtras(filteredExtras);
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
  }, [open, departmentCode, sectionId]);

  // Calculate available quantity for an extra from departmentExtras (filtered by section if provided)
  const getAvailableQuantity = (extra: Extra): number => {
    if (!extra.departmentExtras || extra.departmentExtras.length === 0) {
      return extra.product?.quantity ?? 999; // Use product quantity or unlimited if no department allocation
    }
    
    // First, try to find section-specific allocation if sectionId is provided
    if (sectionId) {
      const sectionAlloc = extra.departmentExtras.find((dept) => dept.sectionId === sectionId);
      if (sectionAlloc) {
        return Math.max(0, (sectionAlloc.quantity || 0) - (sectionAlloc.reserved || 0));
      }
      // If no section-specific allocation, fallback to department-level (sectionId === null)
      const deptAlloc = extra.departmentExtras.find((dept) => dept.sectionId === null);
      if (deptAlloc) {
        return Math.max(0, (deptAlloc.quantity || 0) - (deptAlloc.reserved || 0));
      }
      return 0; // No allocation for this section or department
    }
    
    // If no sectionId, use department-level allocations (sectionId === null)
    const deptAllocations = extra.departmentExtras.filter((dept) => dept.sectionId === null);
    if (deptAllocations.length === 0) {
      return 0;
    }
    
    return deptAllocations.reduce((total, dept) => {
      return total + Math.max(0, (dept.quantity || 0) - (dept.reserved || 0));
    }, 0);
  };

  // Handle checkbox change - selection always sets quantity to 1
  const handleSelectChange = (extraId: string, checked: boolean) => {
    setSelectedExtras((prev) => {
      const updated = new Map(prev);
      if (checked) {
        // When selected, always set quantity to 1
        updated.set(extraId, { extraId, quantity: 1 });
      } else {
        // When deselected, remove from map
        updated.delete(extraId);
      }
      return updated;
    });
    // Clear any previous errors
    setError(null);
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

      // Success - clear state and close dialog
      setSelectedExtras(new Map());
      setExtras([]); // Clear extras list
      onOpenChange(false);
      
      // Refresh order details after successful addition
      if (onSuccess) {
        onSuccess();
      }
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
        ) : (() => {
          // Filter to only show extras with available quantity (no standalone without allocations)
          const availableExtras = extras.filter(
            (extra) =>
              getAvailableQuantity(extra) > 0 &&
              ((extra.departmentExtras && extra.departmentExtras.length > 0) || extra.product)
          );
          return availableExtras.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No extras available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Extras List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {availableExtras.map((extra) => {
                  const selected = selectedExtras.has(extra.id);

                  return (
                    <div
                      key={extra.id}
                      className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                        selected ? 'bg-amber-50 border-amber-300' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      {/* Toggle Switch */}
                      <div className="pt-1">
                        <Switch
                          checked={selected}
                          onCheckedChange={(checked) =>
                            handleSelectChange(extra.id, checked)
                          }
                          disabled={submitting}
                        />
                      </div>
                      
                      {/* Extra Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <label className="font-medium text-sm cursor-pointer">
                            {extra.name}
                          </label>
                          <Badge variant="outline" className="text-xs">
                            {extra.unit}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Available: {getAvailableQuantity(extra)}
                          </Badge>
                        </div>
                        {extra.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {extra.description}
                          </p>
                        )}
                        <p className="text-sm font-semibold text-amber-900 mt-1">
                          {formatCents(extra.price)} each
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

            {/* Total */}
            {selectedExtras.size > 0 && (
              <div className="border-t pt-3 mt-4">
                <div className="flex justify-between items-center font-semibold">
                  <span>Total for {selectedExtras.size} Extra(s)</span>
                  <span className="text-lg text-amber-900">
                    {formatCents(totalPrice)}
                  </span>
                </div>
              </div>
            )}
            </div>
          );
        })()}

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
