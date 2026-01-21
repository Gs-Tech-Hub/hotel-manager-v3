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
  code: string;
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
  available?: number;
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

        // Don't load inventory items initially - they'll be loaded when department is selected
        setInventoryItems([]);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open]);

  // Reload inventory items when department is selected
  useEffect(() => {
    if (!selectedDepartmentId) {
      setInventoryItems([]);
      return;
    }

    const loadDeptInventory = async () => {
      try {
        const selectedDept = departments.find(d => d.id === selectedDepartmentId);
        if (!selectedDept) return;

        if (mode === 'convert') {
          // Fetch inventory items that are NOT yet converted to extras in this department
          const invResponse = await fetch(
            `/api/departments/${selectedDept.code}/inventory-for-extras?limit=999`
          );
          const invData = await invResponse.json();
          if (invData.success && Array.isArray(invData.data.items)) {
            setInventoryItems(invData.data.items);
          }
        } else {
          // For create mode, don't need to fetch inventory items
          setInventoryItems([]);
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
        console.log('Creating extra with:', {
          name: formData.name,
          unit: formData.unit,
          price: formData.price,
        });
        
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
          console.error('Failed to create extra:', createData);
          throw new Error(createData.error?.message || 'Failed to create extra');
        }

        extraId = createData.data.extra.id;
        console.log('Extra created with ID:', extraId);
      }

      // Step 2: Allocate to department
      const selectedDept = departments.find(d => d.id === selectedDepartmentId);
      if (!selectedDept) {
        throw new Error('Department not found');
      }

      console.log('Allocating extra to department:', {
        departmentCode: selectedDept.code,
        extraId,
        quantity: 0,
        sectionId: selectedSectionId === 'unscoped' ? null : (selectedSectionId || null),
      });

      const allocateResponse = await fetch(`/api/departments/${selectedDept.code}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraId,
          quantity: 0, // Start with 0, can be updated later
          sectionId: selectedSectionId === 'unscoped' ? null : (selectedSectionId || null),
        }),
      });

      const allocateData = await allocateResponse.json();
      console.log('Allocation response:', allocateData);
      if (!allocateResponse.ok) {
        console.error('Failed to allocate:', allocateData);
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

      const allocateResponse = await fetch(`/api/departments/${selectedDept.code}/extras`, {
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
              <div className="space-y-3">
                <Label>How to Create Extra</Label>
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
                    ✨ Create New
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
                    📦 From Inventory
                  </button>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800 space-y-1">
                  {mode === 'create' ? (
                    <>
                      <p><strong>Create New:</strong> Make a standalone extra (e.g., sauce, side dish) without inventory tracking.</p>
                      <p>1️⃣ Fill in details → 2️⃣ Select department → ✅ Create</p>
                    </>
                  ) : (
                    <>
                      <p><strong>From Inventory:</strong> Convert an inventory item to an extra with automatic stock tracking.</p>
                      <p>1️⃣ Select department → 2️⃣ Select inventory item → ✅ Convert & Allocate</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Inventory Item Selection (Convert Mode) */}
            {mode === 'convert' && (
              <div className="space-y-3">
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
                    No inventory items found for this department. All items are already converted to extras or not available.
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
                        {item.name} — SKU: {item.sku} (Stock: {item.available || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Summary of what will happen */}
                {selectedInventoryId && (
                  <div className="bg-green-50 border border-green-200 rounded p-3 text-xs text-green-800 space-y-2">
                    {(() => {
                      const selectedItem = inventoryItems.find(i => i.id === selectedInventoryId);
                      return (
                        <>
                          <p className="font-medium">✅ Conversion will:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Convert <strong>{selectedItem?.name}</strong> to an extra</li>
                            <li>Enable automatic inventory tracking</li>
                            <li>Allocate <strong>{selectedItem?.available || 0} units</strong> to {departments.find(d => d.id === selectedDepartmentId)?.name}</li>
                            <li>Current stock syncs from department inventory</li>
                          </ul>
                          <p className="text-xs text-green-700 mt-2">After conversion, you can transfer units to sections as needed.</p>
                        </>
                      );
                    })()}
                  </div>
                )}
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
