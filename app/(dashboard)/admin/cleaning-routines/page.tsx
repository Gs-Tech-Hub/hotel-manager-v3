/**
 * Admin page for managing cleaning routines
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit2, Trash2, Loader } from 'lucide-react';

interface CleaningRoutine {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  frequency: string;
  estimatedMinutes: number;
  priority: string;
  isActive: boolean;
  createdAt: string;
}

interface ChecklistItem {
  item: string;
  required: boolean;
}

export default function CleaningRoutinesAdminPage() {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<CleaningRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    type: 'TURNOVER',
    frequency: 'EVERY_CHECKOUT',
    estimatedMinutes: 30,
    priority: 'NORMAL',
    checklist: [] as ChecklistItem[],
    notes: '',
  });

  const [newChecklistItem, setNewChecklistItem] = useState('');

  // Fetch routines
  useEffect(() => {
    fetchRoutines();
  }, []);

  const fetchRoutines = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cleaning-routines');
      if (response.ok) {
        const data = await response.json();
        setRoutines(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching routines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'estimatedMinutes' ? parseInt(value) : value,
    }));
  };

  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setFormData((prev) => ({
        ...prev,
        checklist: [...prev.checklist, { item: newChecklistItem, required: true }],
      }));
      setNewChecklistItem('');
    }
  };

  const handleRemoveChecklistItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      const url = editingId
        ? `/api/cleaning-routines/${editingId}`
        : '/api/cleaning-routines';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchRoutines();
        resetForm();
        setShowForm(false);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error saving routine:', error);
      alert('Error saving routine');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (routine: CleaningRoutine) => {
    setFormData({
      code: routine.code,
      name: routine.name,
      description: routine.description || '',
      type: routine.type,
      frequency: routine.frequency,
      estimatedMinutes: routine.estimatedMinutes,
      priority: routine.priority,
      checklist: [], // Would need to fetch full details
      notes: '',
    });
    setEditingId(routine.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this routine?')) return;

    try {
      const response = await fetch(`/api/cleaning-routines/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchRoutines();
      } else {
        alert('Error deleting routine');
      }
    } catch (error) {
      console.error('Error deleting routine:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      type: 'TURNOVER',
      frequency: 'EVERY_CHECKOUT',
      estimatedMinutes: 30,
      priority: 'NORMAL',
      checklist: [],
      notes: '',
    });
    setEditingId(null);
    setNewChecklistItem('');
  };

  if (!user?.roles?.includes('admin')) {
    return <div className="p-4">Unauthorized</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cleaning Routines</h1>
          <p className="text-gray-600">Manage cleaning templates and schedules</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          New Routine
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Routine' : 'Create New Routine'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    placeholder="e.g., ROUTINE_TURNOVER"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Turnover Cleaning"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe this cleaning routine"
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, type: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TURNOVER">Turnover</SelectItem>
                      <SelectItem value="DEEP">Deep</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      <SelectItem value="TOUCH_UP">Touch-Up</SelectItem>
                      <SelectItem value="LINEN_CHANGE">Linen Change</SelectItem>
                      <SelectItem value="NIGHT_AUDIT">Night Audit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select value={formData.frequency} onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, frequency: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EVERY_CHECKOUT">Every Checkout</SelectItem>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="AS_NEEDED">As Needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="estimatedMinutes">Est. Minutes</Label>
                  <Input
                    id="estimatedMinutes"
                    name="estimatedMinutes"
                    type="number"
                    value={formData.estimatedMinutes}
                    onChange={handleInputChange}
                    min="5"
                  />
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, priority: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Checklist Items</Label>
                <div className="space-y-2 mb-2">
                  {formData.checklist.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-100 p-2 rounded"
                    >
                      <span className="text-sm">{item.item}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(index)}
                        className="text-red-500 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    placeholder="Add checklist item"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddChecklistItem}
                    variant="outline"
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Additional notes"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={formLoading}>
                  {formLoading && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                  {editingId ? 'Update' : 'Create'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center p-8">
          <Loader className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {routines.map((routine) => (
            <Card key={routine.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{routine.name}</CardTitle>
                    <CardDescription>{routine.code}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(routine)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(routine.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Type</p>
                    <p className="font-medium">{routine.type}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Frequency</p>
                    <p className="font-medium">{routine.frequency}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Est. Time</p>
                    <p className="font-medium">{routine.estimatedMinutes} min</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Priority</p>
                    <p className="font-medium text-yellow-600">{routine.priority}</p>
                  </div>
                </div>
                {routine.description && (
                  <p className="mt-3 text-sm text-gray-600">{routine.description}</p>
                )}
              </CardContent>
            </Card>
          ))}

          {routines.length === 0 && (
            <Card>
              <CardContent className="pt-8">
                <p className="text-center text-gray-600">
                  No cleaning routines yet. Create one to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
