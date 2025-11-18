"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function InventoryOperationsPage() {
  const [payload, setPayload] = useState({ itemId: '', type: 'adjust', quantity: 0, notes: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setPayload((p) => ({ ...p, [name]: name === 'quantity' ? Number(value) : value }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setMessage(null);
    if (!payload.itemId) return setMessage('Item ID is required');
    setIsSaving(true);
    try {
      const res = await fetch('/api/inventory/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage('Operation recorded');
        setPayload({ itemId: '', type: 'adjust', quantity: 0, notes: '' });
      } else {
        setMessage(data?.message || 'Failed to record operation');
      }
    } catch (e: any) {
      setMessage(e?.message || 'Network error');
    } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Inventory Operations</h1>
        <p className="text-sm text-muted-foreground">Record stock adjustments or inventory operations (quick mode).</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Operation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="itemId">Item ID</Label>
              <Input id="itemId" name="itemId" value={payload.itemId} onChange={handleChange} placeholder="e.g. food_123 or drink_456" />
            </div>

            <div>
              <Label htmlFor="type">Type</Label>
              <select id="type" name="type" value={payload.type} onChange={handleChange} className="w-full rounded-md border px-3 py-2">
                <option value="adjust">Adjust</option>
                <option value="add">Add</option>
                <option value="remove">Remove</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>

            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" value={payload.quantity} onChange={handleChange} type="number" />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" name="notes" value={payload.notes} onChange={handleChange} className="w-full rounded-md border p-2" />
            </div>

            {message && <div className="text-sm text-muted-foreground">{message}</div>}

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Record'}</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
