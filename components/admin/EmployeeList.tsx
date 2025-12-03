"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import ConfirmDialog from './ConfirmDialog';

function EmployeeForm({ onCreated, onClose }: { onCreated: (e: any) => void, onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, role }) });
      const data = await res.json();
      if (res.ok) { onCreated(data.data); onClose(); } else console.error(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form className="bg-white p-6 rounded shadow w-96" onSubmit={handleSubmit}>
        <h3 className="text-lg font-semibold mb-2">Create Employee</h3>
        <input className="w-full mb-2 p-2 border rounded" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
        <input className="w-full mb-2 p-2 border rounded" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required type="email" />
        <select className="w-full mb-2 p-2 border rounded" value={role} onChange={e => setRole(e.target.value)}>
          <option value="staff">Staff</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        <div className="flex gap-2 mt-2">
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded" disabled={loading}>Create</button>
          <button type="button" className="px-3 py-1 bg-gray-300 rounded" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function EmployeeList() {
  const { hasPermission } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/employees');
      const data = await res.json();
      if (res.ok) setEmployees(data.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  useEffect(() => { fetchList(); }, []);

  async function handleCreated(e: any) { setEmployees((s) => [e, ...s]); }

  async function confirmDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/employees/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setEmployees((s) => s.filter(x => x.id !== id));
    } catch (err) { console.error(err); } finally { setDeletingId(null); }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Employees</h2>
        {hasPermission('employees.create') && (
          <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => setShowCreate(true)}>Create Employee</button>
        )}
      </div>
      <div className="mt-4">
        {loading && <div>Loading...</div>}
        {!loading && employees.length === 0 && <div className="text-sm text-gray-500">No employees</div>}
        <div className="mt-2 overflow-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Role</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(e => (
                <tr key={e.id} className="border-t">
                  <td className="p-2">{e.name}</td>
                  <td className="p-2">{e.email}</td>
                  <td className="p-2">{e.role}</td>
                  <td className="p-2">{hasPermission('employees.delete') && (
                    <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => setDeletingId(e.id)}>Delete</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <EmployeeForm onCreated={handleCreated} onClose={() => setShowCreate(false)} />}
      {deletingId && <ConfirmDialog title="Delete Employee" message="This will deactivate the employee. Continue?" onCancel={() => setDeletingId(null)} onConfirm={() => confirmDelete(deletingId)} />}
    </div>
  );
}
