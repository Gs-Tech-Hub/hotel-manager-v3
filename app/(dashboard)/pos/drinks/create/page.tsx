"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DrinkCreatePage() {
  const router = useRouter();
  const [item, setItem] = useState<any>({ name: "", category: "", price: 0, stock: 0, description: "", active: true });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setItem((s: any) => ({ ...s, [name]: name === 'price' || name === 'stock' ? Number(value) : value }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError(null);
    if (!item.name) return setError('Name is required');
    setIsSaving(true);
    try {
      const res = await fetch('/api/drinks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push('/dashboard/pos/drinks');
      } else {
        setError(data?.message || 'Failed to create item');
      }
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Create Drink Item</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Basic</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" value={item.name} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" value={item.category} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="price">Price (cents)</Label>
              <Input id="price" name="price" value={item.price} onChange={handleChange} type="number" />
            </div>
            <div>
              <Label htmlFor="stock">Stock</Label>
              <Input id="stock" name="stock" value={item.stock} onChange={handleChange} type="number" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" value={item.description} onChange={handleChange} rows={6} />
              </div>

              {error && <div className="text-destructive">{error}</div>}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => router.push('/dashboard/pos/drinks')}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? 'Creating...' : 'Create'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
