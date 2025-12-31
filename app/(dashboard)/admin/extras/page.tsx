'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatPrice } from '@/lib/price';
import { ExtrasFormDialog } from '@/components/admin/ExtrasFormDialog';

interface Extra {
  id: string;
  name: string;
  description?: string;
  unit: string;
  price: number;
  departmentId?: string;
  productId?: string;
  trackInventory?: boolean;
  isActive: boolean;
  product?: {
    name: string;
    sku: string;
    quantity: number;
  };
  department?: {
    name: string;
    code: string;
  };
}

export default function ExtrasPage() {
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedExtra, setSelectedExtra] = useState<Extra | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch extras
  useEffect(() => {
    fetchExtras();
  }, []);

  const fetchExtras = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/extras');
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setExtras(data.data);
      } else {
        throw new Error('Failed to load extras');
      }
    } catch (err) {
      console.error('Error loading extras:', err);
      setError(err instanceof Error ? err.message : 'Failed to load extras');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (extraId: string) => {
    if (!confirm('Are you sure you want to delete this extra?')) return;

    try {
      const response = await fetch(`/api/extras/${extraId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete extra');

      setExtras(extras.filter(e => e.id !== extraId));
    } catch (err) {
      console.error('Error deleting extra:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete extra');
    }
  };

  const handleFormSuccess = () => {
    setSelectedExtra(null);
    setFormOpen(false);
    fetchExtras();
  };

  const filteredExtras = extras.filter(extra =>
    extra.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    extra.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Extras</h1>
          <p className="text-muted-foreground mt-1">
            Manage supplementary items for orders
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedExtra(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Extra
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search extras..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-md"
      />

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Extras</CardTitle>
          <CardDescription>
            {filteredExtras.length} extras found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredExtras.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No extras found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExtras.map((extra) => (
                    <TableRow key={extra.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{extra.name}</p>
                          {extra.description && (
                            <p className="text-sm text-muted-foreground">
                              {extra.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{extra.unit}</TableCell>
                      <TableCell>{formatPrice(extra.price / 100)}</TableCell>
                      <TableCell>
                        {extra.trackInventory ? (
                          <Badge variant="default">Tracked</Badge>
                        ) : (
                          <Badge variant="outline">Standalone</Badge>
                        )}
                        {extra.product && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Stock: {extra.product.quantity}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {extra.department?.name || '—'}
                      </TableCell>
                      <TableCell>
                        {extra.isActive ? (
                          <Badge>Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedExtra(extra);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(extra.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <ExtrasFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        extra={selectedExtra}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
