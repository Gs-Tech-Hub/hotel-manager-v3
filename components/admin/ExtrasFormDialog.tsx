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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface Extra {
  id?: string;
  name: string;
  description?: string;
  unit: string;
  price: number;
  departmentSectionId?: string;
  productId?: string;
  trackInventory?: boolean;
  isActive?: boolean;
}

interface DepartmentSection {
  id: string;
  name: string;
  slug?: string;
  departmentId: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
}

interface ExtrasFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extra?: Extra | null;
  onSuccess?: () => void;
}

export function ExtrasFormDialog({
  open,
  onOpenChange,
  extra,
  onSuccess,
}: ExtrasFormDialogProps) {
  const [formData, setFormData] = useState<Extra>({
    name: '',
    description: '',
    unit: 'portion',
    price: 0,
    departmentSectionId: '',
    productId: '',
    trackInventory: false,
    isActive: true,
  });

  const [sections, setSections] = useState<DepartmentSection[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load departments and sections
  useEffect(() => {
    if (!open) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load sections
        const sectResponse = await fetch('/api/departments/sections');
        const sectData = await sectResponse.json();
        if (sectData.success && Array.isArray(sectData.data)) {
          setSections(sectData.data);
        }

        // Load inventory items
        const invResponse = await fetch('/api/inventory');
        const invData = await invResponse.json();
        if (invData.success && Array.isArray(invData.data)) {
          setInventoryItems(invData.data);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open]);

  // Initialize form with extra data
  useEffect(() => {
    if (extra) {
      setFormData(extra);
    } else {
      setFormData({
        name: '',
        description: '',
        unit: 'portion',
        price: 0,
        departmentSectionId: '',
        productId: '',
        trackInventory: false,
        isActive: true,
      });
    }
  }, [extra, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.unit.trim()) {
      setError('Unit is required');
      return;
    }
    if (formData.price <= 0) {
      setError('Price must be greater than 0');
      return;
    }
    if (!formData.departmentSectionId) {
      setError('Section is required');
      return;
    }

    try {
      setSubmitting(true);

      const method = extra ? 'PUT' : 'POST';
      const url = extra ? `/api/extras/${extra.id}` : '/api/extras';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to save extra');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error saving extra:', err);
      setError(err instanceof Error ? err.message : 'Failed to save extra');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {extra ? 'Edit Extra' : 'Create New Extra'}
          </DialogTitle>
          <DialogDescription>
            {extra
              ? 'Update the extra details'
              : 'Add a new supplementary item to your restaurant'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Extra Sauce"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={submitting}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description"
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                disabled={submitting}
                rows={2}
              />
            </div>

            {/* Unit */}
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                placeholder="e.g., portion, container, pump"
                value={formData.unit}
                onChange={(e) =>
                  setFormData({ ...formData, unit: e.target.value })
                }
                disabled={submitting}
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.price > 0 ? formData.price / 100 : ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: Math.round(parseFloat(e.target.value) * 100) || 0,
                  })
                }
                disabled={submitting}
              />
            </div>

            {/* Section */}
            <div className="space-y-2">
              <Label htmlFor="section">Section</Label>
              <Select
                value={formData.departmentSectionId || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, departmentSectionId: value })
                }
                disabled={submitting}
              >
                <SelectTrigger id="section">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((sect) => (
                    <SelectItem key={sect.id} value={sect.id}>
                      {sect.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Track Inventory */}
            <div className="space-y-2 flex items-center justify-between">
              <Label htmlFor="trackInventory">Track Inventory</Label>
              <Switch
                id="trackInventory"
                checked={formData.trackInventory || false}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    trackInventory: checked,
                    productId: checked ? formData.productId : '',
                  })
                }
                disabled={submitting}
              />
            </div>

            {/* Product (only if tracking) */}
            {formData.trackInventory && (
              <div className="space-y-2">
                <Label htmlFor="product">Inventory Item</Label>
                <Select
                  value={formData.productId || ''}
                  onValueChange={(value) =>
                    setFormData({ ...formData, productId: value })
                  }
                  disabled={submitting}
                >
                  <SelectTrigger id="product">
                    <SelectValue placeholder="Select inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} (Stock: {item.quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Active Status */}
            <div className="space-y-2 flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive !== false}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    isActive: checked,
                  })
                }
                disabled={submitting}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Extra'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
