"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import ConfirmDialog from './ConfirmDialog';

function DiscountForm({ onCreated, onClose }: { onCreated: (d: any) => void, onClose: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('percentage');
  const [value, setValue] = useState('0');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase(),
          name,
          type,
          value: Number(value),
          description,
          startDate: new Date(startDate).toISOString(),
          isActive: true,
        }),
      });
      const data = await res.json();
      if (res.ok) { onCreated(data.data); onClose(); }
      else { console.error(data); alert(data.error || 'Failed to create discount'); }
    } catch (err) { console.error(err); alert('Error creating discount'); } 
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form className="bg-white p-6 rounded shadow w-96 max-h-96 overflow-y-auto" onSubmit={handleSubmit}>
        <h3 className="text-lg font-semibold mb-4">Create Discount</h3>
        <input className="w-full mb-2 p-2 border rounded" placeholder="Code (e.g., SUMMER2025)" value={code} onChange={e => setCode(e.target.value)} required />
        <input className="w-full mb-2 p-2 border rounded" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <select className="w-full mb-2 p-2 border rounded" value={type} onChange={e => setType(e.target.value)}>
          <option value="percentage">Percentage (%)</option>
          <option value="fixed">Fixed Amount ($)</option>
          <option value="employee">Employee Discount</option>
          <option value="bulk">Bulk Discount</option>
          <option value="tiered">Tiered</option>
        </select>
        <input className="w-full mb-2 p-2 border rounded" placeholder="Value" type="number" value={value} onChange={e => setValue(e.target.value)} required />
        <input className="w-full mb-2 p-2 border rounded" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
        <input className="w-full mb-2 p-2 border rounded" type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required />
        <div className="flex gap-2 mt-4">
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
      if (res.ok && data.data && data.data.rules) {
        setDiscounts(data.data.rules || []);
      } else if (res.ok && Array.isArray(data.data)) {
        setDiscounts(data.data);
      } else {
        console.error('Unexpected response format:', data);
        setDiscounts([]);
      }
    } catch (err) { 
      console.error('Error fetching discounts:', err); 
      setDiscounts([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchList(); }, []);

  async function handleCreated(d: any) { setDiscounts((s) => [d, ...s]); }

  async function confirmDelete(id: string) {
    try {
      const res = await fetch(`/api/discounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDiscounts((s) => s.filter(x => x.id !== id));
    } catch (err) { console.error(err); alert('Failed to delete discount'); } 
    finally { setDeletingId(null); }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Discounts</h2>
        {hasPermission('discounts.create') && (
          <button className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => setShowCreate(true)}>
            + Create Discount
          </button>
        )}
      </div>
      <div className="mt-4">
        {loading && <div className="text-center py-4">Loading discounts...</div>}
        {!loading && discounts.length === 0 && <div className="text-center py-4 text-gray-500">No discounts found</div>}
        {discounts.length > 0 && (
          <div className="overflow-x-auto border rounded">
            <table className="w-full table-auto">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Value</th>
                  <th className="text-left p-3">Active</th>
                  <th className="text-left p-3">Start Date</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map(d => (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-mono font-semibold text-sm">{d.code}</td>
                    <td className="p-3">{d.name || '-'}</td>
                    <td className="p-3"><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">{d.type}</span></td>
                    <td className="p-3">{d.type === 'percentage' ? `${d.value}%` : `$${(d.value / 100).toFixed(2)}`}</td>
                    <td className="p-3"><span className={d.isActive ? 'text-green-600 font-semibold' : 'text-red-600'}>{d.isActive ? 'Yes' : 'No'}</span></td>
                    <td className="p-3 text-sm">{d.startDate ? new Date(d.startDate).toLocaleDateString() : '-'}</td>
                    <td className="p-3">{hasPermission('discounts.delete') && (
                      <button 
                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm" 
                        onClick={() => setDeletingId(d.id)}
                      >
                        Delete
                      </button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <DiscountForm onCreated={handleCreated} onClose={() => setShowCreate(false)} />}
      {deletingId && (
        <ConfirmDialog 
          title="Delete Discount" 
          message="This will deactivate the discount. Continue?" 
          onCancel={() => setDeletingId(null)} 
          onConfirm={() => confirmDelete(deletingId)} 
        />
      )}
    </div>
  );
}
