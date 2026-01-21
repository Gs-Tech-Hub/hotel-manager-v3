'use client';

import { useEffect, useState } from 'react';
import { Loader2, ArrowRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatPrice } from '@/lib/price';

interface Item {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  available: number;
  itemType: 'inventory' | 'extra';
  unit?: string;
  price?: number;
  trackInventory?: boolean;
  departmentInventoryId?: string;
  departmentExtraId?: string;
}

interface DepartmentItemsTableProps {
  departmentCode: string;
  sectionId?: string;
  onTransfer?: (item: Item) => void;
  onConvertToExtra?: (item: Item) => void;
}

export function DepartmentItemsTable({
  departmentCode,
  sectionId,
  onTransfer,
  onConvertToExtra,
}: DepartmentItemsTableProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, [departmentCode, sectionId]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = new URL(
        `/api/departments/${departmentCode}/items`,
        window.location.origin
      );
      if (sectionId) {
        url.searchParams.set('sectionId', sectionId);
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.success && Array.isArray(data.data.items)) {
        setItems(data.data.items);
      } else {
        throw new Error('Failed to load items');
      }
    } catch (err) {
      console.error('Error loading items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No items available for this {sectionId ? 'section' : 'department'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted">
            <TableHead>Name</TableHead>
            <TableHead>SKU / Unit</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead>Price</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.itemType}-${item.id}`} className="hover:bg-muted/50">
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  {item.itemType === 'extra' && (
                    <Badge variant="default" className="text-xs">
                      Extra
                    </Badge>
                  )}
                  {item.trackInventory && (
                    <Badge variant="outline" className="text-xs">
                      Tracked
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {item.itemType === 'inventory' ? item.sku : item.unit}
              </TableCell>
              <TableCell>
                <span className="text-sm">{item.category}</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {item.quantity}
              </TableCell>
              <TableCell className="text-right">
                <span className={item.available < 5 ? 'text-amber-600 font-medium' : ''}>
                  {item.available}
                </span>
              </TableCell>
              <TableCell>
                {item.price ? (
                  <span className="text-sm">${formatPrice(item.price / 100)}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onTransfer && (
                      <DropdownMenuItem onClick={() => onTransfer(item)}>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Transfer
                      </DropdownMenuItem>
                    )}
                    {item.itemType === 'inventory' && onConvertToExtra && (
                      <DropdownMenuItem onClick={() => onConvertToExtra(item)}>
                        Convert to Extra
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
