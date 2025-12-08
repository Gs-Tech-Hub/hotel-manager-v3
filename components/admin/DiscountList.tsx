"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import ConfirmDialog from './ConfirmDialog';

function DiscountForm({ onCreated, onClose }: { onCreated: (d: any) => void, onClose: () => void }) {
  const [name, setName] = useState('');
  const [percent, setPercent] = useState('0');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/discounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, percent: Number(percent) }),
      });
      const data = await res.json();
      if (res.ok) { onCreated(data.data); onClose(); }
      else console.error(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form className="bg-white p-6 rounded shadow w-80" onSubmit={handleSubmit}>
        <h3 className="text-lg font-semibold mb-2">Create Discount</h3>
        <input className="w-full mb-2 p-2 border rounded" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
        <input className="w-full mb-2 p-2 border rounded" placeholder="Percent" value={percent} onChange={e => setPercent(e.target.value)} required />
        <div className="flex gap-2 mt-2">
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded" disabled={loading}>Create</button>
          <button type="button" className="px-3 py-1 bg-gray-300 rounded" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function DiscountList() {
  const { hasPermission } = useAuth();
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch('/api/discounts');
      const data = await res.json();
      if (res.ok) setDiscounts(data.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  useEffect(() => { fetchList(); }, []);

  async function handleCreated(d: any) { setDiscounts((s) => [d, ...s]); }

  async function confirmDelete(id: string) {
    try {
      const res = await fetch(`/api/discounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDiscounts((s) => s.filter(x => x.id !== id));
    } catch (err) { console.error(err); } finally { setDeletingId(null); }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Discounts</h2>
        {hasPermission('discounts.create') && (
          <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => setShowCreate(true)}>Create Discount</button>
        )}
      </div>
      <div className="mt-4">
        {loading && <div>Loading...</div>}
        {!loading && discounts.length === 0 && <div className="text-sm text-gray-500">No discounts</div>}
        <div className="mt-2 overflow-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Percent</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map(d => (
                <tr key={d.id} className="border-t">
                  <td className="p-2">{d.name}</td>
                  <td className="p-2">{d.percent}</td>
                  <td className="p-2">{hasPermission('discounts.delete') && (
                    <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => setDeletingId(d.id)}>Delete</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <DiscountForm onCreated={handleCreated} onClose={() => setShowCreate(false)} />}
      {deletingId && <ConfirmDialog title="Delete Discount" message="This will deactivate the discount. Continue?" onCancel={() => setDeletingId(null)} onConfirm={() => confirmDelete(deletingId)} />}
    </div>
  );
}
