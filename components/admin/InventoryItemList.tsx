"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import ConfirmDialog from './ConfirmDialog';

function InventoryForm({ onCreated, onClose }: { onCreated: (item: any) => void, onClose: () => void }) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('0.00');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sku, price }),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated(data.data);
        onClose();
      } else {
        console.error(data);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form className="bg-white p-6 rounded shadow w-96" onSubmit={handleSubmit}>
        <h3 className="text-lg font-semibold mb-2">Create Inventory Item</h3>
        <input className="w-full mb-2 p-2 border rounded" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
        <input className="w-full mb-2 p-2 border rounded" placeholder="SKU" value={sku} onChange={e => setSku(e.target.value)} required />
        <input className="w-full mb-2 p-2 border rounded" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)} required />
        <div className="flex gap-2 mt-2">
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded" disabled={loading}>Create</button>
          <button type="button" className="px-3 py-1 bg-gray-300 rounded" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function InventoryItemList() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (res.ok) setItems(data.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  useEffect(() => { fetchList(); }, []);

  async function handleCreated(item: any) { setItems((s) => [item, ...s]); }

  async function confirmDelete(id: string) {
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setItems((s) => s.filter(i => i.id !== id));
    } catch (err) { console.error(err); } finally { setDeletingId(null); }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Inventory Items</h2>
        {hasPermission('inventory_items.create') && (
          <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => setShowCreate(true)}>Create Item</button>
        )}
      </div>
      <div className="mt-4">
        {loading && <div>Loading...</div>}
        {!loading && items.length === 0 && <div className="text-sm text-gray-500">No items</div>}
        <div className="mt-2 overflow-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">SKU</th>
                <th className="text-left p-2">Price</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id} className="border-t">
                  <td className="p-2">{i.name}</td>
                  <td className="p-2">{i.sku}</td>
                  <td className="p-2">{i.price}</td>
                  <td className="p-2">{hasPermission('inventory_items.delete') && (
                    <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => setDeletingId(i.id)}>Delete</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <InventoryForm onCreated={handleCreated} onClose={() => setShowCreate(false)} />}

      {deletingId && (
        <ConfirmDialog title="Delete Item" message="This will deactivate the item. Continue?" onCancel={() => setDeletingId(null)} onConfirm={() => confirmDelete(deletingId)} />
      )}
    </div>
  );
}
