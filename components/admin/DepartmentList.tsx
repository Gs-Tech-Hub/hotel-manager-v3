"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import DepartmentForm from './DepartmentForm';
import ConfirmDialog from './ConfirmDialog';

export default function DepartmentList() {
  const { hasPermission } = useAuth();
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (res.ok) setDepartments(data.data || []);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchList(); }, []);

  async function handleCreated(dept: any) {
    setDepartments((s) => [dept, ...s]);
  }

  async function confirmDelete(id: string) {
    try {
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      // optimistic: remove
      setDepartments((s) => s.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Departments</h2>
        {hasPermission('departments.create') && (
          <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => setShowCreate(true)}>Create Department</button>
        )}
      </div>

      <div className="mt-4">
        {loading && <div>Loading...</div>}
        {!loading && departments.length === 0 && <div className="text-sm text-gray-500">No departments</div>}
        <div className="mt-2 overflow-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2">Code</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="p-2">{d.code}</td>
                  <td className="p-2">{d.name}</td>
                  <td className="p-2">{d.type || '-'}</td>
                  <td className="p-2">
                    {hasPermission('departments.delete') && (
                      <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => setDeletingId(d.id)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <DepartmentForm onCreated={handleCreated} onClose={() => setShowCreate(false)} />}

      {deletingId && (
        <ConfirmDialog
          title="Delete Department"
          message="This will deactivate the department. Are you sure?"
          onCancel={() => setDeletingId(null)}
          onConfirm={() => confirmDelete(deletingId)}
        />
      )}
    </div>
  );
}
