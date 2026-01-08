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
  productId?: string;
  trackInventory?: boolean;
  isActive?: boolean;
}

interface Department {
  id: string;
  name: string;
  departmentCode: string;
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
    productId: '',
    trackInventory: false,
    isActive: true,
  });

  const [mode, setMode] = useState<'create' | 'convert'>('create');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
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

        // Load departments
        const deptResponse = await fetch('/api/departments');
        const deptData = await deptResponse.json();
        if (deptData.success && Array.isArray(deptData.data)) {
          setDepartments(deptData.data);
        }

        // Load sections
        const sectResponse = await fetch('/api/departments/sections');
        const sectData = await sectResponse.json();
        if (sectData.success && Array.isArray(sectData.data)) {
          setSections(sectData.data);
        }

        // Load all inventory items initially
        const invResponse = await fetch('/api/inventory?limit=999');
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

  // Reload inventory items when department is selected in convert mode
  useEffect(() => {
    if (mode !== 'convert' || !selectedDepartmentId) return;

    const loadDeptInventory = async () => {
      try {
        const selectedDept = departments.find(d => d.id === selectedDepartmentId);
        if (!selectedDept) return;

        // Fetch inventory filtered by department
        const invResponse = await fetch(`/api/inventory?departmentId=${selectedDept.id}&limit=999`);
        const invData = await invResponse.json();
        if (invData.success && Array.isArray(invData.data)) {
          setInventoryItems(invData.data);
        }
      } catch (err) {
        console.error('Error loading department inventory:', err);
      }
    };

    loadDeptInventory();
  }, [mode, selectedDepartmentId, departments]);

  // Initialize form with extra data
  useEffect(() => {
    if (extra) {
      setFormData(extra);
      setMode('create'); // editing existing
    } else {
      setFormData({
        name: '',
        description: '',
        unit: 'portion',
        price: 0,
        productId: '',
        trackInventory: false,
        isActive: true,
      });
      setMode('create');
      setSelectedDepartmentId('');
      setSelectedSectionId('');
      setSelectedInventoryId('');
    }
  }, [extra, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'convert') {
      return handleConvertInventoryItem();
    }

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
    if (!selectedDepartmentId) {
      setError('Department is required');
      return;
    }

    try {
      setSubmitting(true);

      // Step 1: Create the extra at the global level
      let extraId = extra?.id;
      if (!extraId) {
        const createResponse = await fetch('/api/extras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || '',
            unit: formData.unit,
            price: formData.price,
            productId: formData.productId || null,
            trackInventory: formData.trackInventory || false,
            isActive: formData.isActive !== false,
          }),
        });

        const createData = await createResponse.json();
        if (!createResponse.ok) {
          throw new Error(createData.error?.message || 'Failed to create extra');
        }

        extraId = createData.data.extra.id;
      }

      // Step 2: Allocate to department
      const selectedDept = departments.find(d => d.id === selectedDepartmentId);
      if (!selectedDept) {
        throw new Error('Department not found');
      }

      const allocateResponse = await fetch(`/api/departments/${selectedDept.departmentCode}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraId,
          quantity: 0, // Start with 0, can be updated later
          sectionId: selectedSectionId === 'unscoped' ? null : (selectedSectionId || null),
        }),
      });

      const allocateData = await allocateResponse.json();
      if (!allocateResponse.ok) {
        throw new Error(allocateData.error?.message || 'Failed to allocate extra to department');
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

  const handleConvertInventoryItem = async () => {
    if (!selectedInventoryId) {
      setError('Please select an inventory item');
      return;
    }
    if (!selectedDepartmentId) {
      setError('Department is required');
      return;
    }

    try {
      setSubmitting(true);

      // Step 1: Convert inventory item to extra
      const convertResponse = await fetch('/api/extras/from-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedInventoryId,
          unit: formData.unit,
          priceOverride: formData.price || undefined,
          trackInventory: true,
        }),
      });

      const convertData = await convertResponse.json();
      if (!convertResponse.ok) {
        throw new Error(convertData.error?.message || 'Failed to convert inventory item');
      }

      const extraId = convertData.data.extra.id;

      // Step 2: Allocate to department
      const selectedDept = departments.find(d => d.id === selectedDepartmentId);
      if (!selectedDept) {
        throw new Error('Department not found');
      }

      const allocateResponse = await fetch(`/api/departments/${selectedDept.departmentCode}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraId,
          quantity: 0,
          sectionId: selectedSectionId === 'unscoped' ? null : (selectedSectionId || null),
        }),
      });

      const allocateData = await allocateResponse.json();
      if (!allocateResponse.ok) {
        throw new Error(allocateData.error?.message || 'Failed to allocate extra to department');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error converting inventory item:', err);
      setError(err instanceof Error ? err.message : 'Failed to convert inventory item');
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

            {/* Mode Selector (only if creating new) */}
            {!extra && (
              <div className="space-y-2">
                <Label>Create Mode</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('create')}
                    className={`flex-1 py-2 px-3 rounded border text-sm font-medium transition-colors ${
                      mode === 'create'
                        ? 'bg-blue-50 border-blue-300 text-blue-900'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                    disabled={submitting}
                  >
                    Create New
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('convert')}
                    className={`flex-1 py-2 px-3 rounded border text-sm font-medium transition-colors ${
                      mode === 'convert'
                        ? 'bg-blue-50 border-blue-300 text-blue-900'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                    disabled={submitting}
                  >
                    Convert Item
                  </button>
                </div>
              </div>
            )}

            {/* Inventory Item Selection (Convert Mode) */}
            {mode === 'convert' && (
              <div className="space-y-2">
                <Label htmlFor="inventoryItem">
                  Inventory Item *
                  {selectedDepartmentId && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (from {departments.find(d => d.id === selectedDepartmentId)?.name})
                    </span>
                  )}
                </Label>
                {!selectedDepartmentId && (
                  <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                    Please select a department first to see available inventory items
                  </div>
                )}
                {selectedDepartmentId && inventoryItems.length === 0 && (
                  <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                    No inventory items found for this department
                  </div>
                )}
                <Select
                  value={selectedInventoryId || ''}
                  onValueChange={(value) => {
                    if (value === '') return; // Ignore empty selection
                    setSelectedInventoryId(value);
                    // Auto-fill unit from inventory item
                    const item = inventoryItems.find(i => i.id === value);
                    if (item) {
                      setFormData(prev => ({
                        ...prev,
                        unit: 'portion', // default unit
                      }));
                    }
                  }}
                  disabled={submitting || !selectedDepartmentId || inventoryItems.length === 0}
                >
                  <SelectTrigger id="inventoryItem">
                    <SelectValue placeholder={
                      !selectedDepartmentId 
                        ? "Select a department first"
                        : inventoryItems.length === 0
                        ? "No items available"
                        : "Select inventory item to convert"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map((item: any) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} — SKU: {item.sku} (Stock: {item.quantity || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Name (Create Mode) */}
            {mode === 'create' && (
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
            )}

            {/* Description (Create Mode) */}
            {mode === 'create' && (
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
            )}

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

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={selectedDepartmentId || ''}
                onValueChange={(value) => {
                  setSelectedDepartmentId(value);
                  setSelectedSectionId(''); // Reset section when department changes
                }}
                disabled={submitting}
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section (optional) */}
            {selectedDepartmentId && (
              <div className="space-y-2">
                <Label htmlFor="section">Section (Optional)</Label>
                <Select
                  value={selectedSectionId || 'unscoped'}
                  onValueChange={(value) => setSelectedSectionId(value === 'unscoped' ? '' : value)}
                  disabled={submitting}
                >
                  <SelectTrigger id="section">
                    <SelectValue placeholder="Select section (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unscoped">Unscoped (all sections)</SelectItem>
                    {sections
                      .filter((s) => s.departmentId === selectedDepartmentId)
                      .map((sect) => (
                        <SelectItem key={sect.id} value={sect.id}>
                          {sect.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Track Inventory (Create Mode Only) */}
            {mode === 'create' && (
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
            )}

            {/* Product (only if tracking and create mode) */}
            {mode === 'create' && formData.trackInventory && (
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

            {/* Active Status (Create Mode Only) */}
            {mode === 'create' && (
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
            )}

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
                    {mode === 'convert' ? 'Converting...' : 'Saving...'}
                  </>
                ) : (
                  mode === 'convert' ? 'Convert to Extra' : 'Save Extra'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
