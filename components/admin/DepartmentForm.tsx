"use client";
import React, { useState } from 'react';

type Props = {
  initial?: { code?: string; name?: string; description?: string };
  onCreated?: (dept: any) => void;
  onClose?: () => void;
};

export default function DepartmentForm({ initial = {}, onCreated, onClose }: Props) {
  const [code, setCode] = useState(initial.code || '');
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code || !name) {
      setError('Code and name are required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, description }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Failed to create');
      onCreated?.(body.data);
      onClose?.();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <form className="bg-white p-6 rounded shadow-md w-full max-w-lg" onSubmit={submit}>
        <h3 className="text-lg font-semibold">Create Department</h3>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        <div className="mt-4 grid grid-cols-1 gap-3">
          <label className="flex flex-col text-sm">
            Code
            <input className="mt-1 p-2 border rounded" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <label className="flex flex-col text-sm">
            Name
            <input className="mt-1 p-2 border rounded" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col text-sm">
            Description
            <textarea className="mt-1 p-2 border rounded" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
