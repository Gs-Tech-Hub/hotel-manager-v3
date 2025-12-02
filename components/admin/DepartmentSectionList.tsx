"use client";
import React, { useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

function SectionForm({ departmentId, onCreated, onClose }: { departmentId: string, onCreated: (section: any) => void, onClose: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/department-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, departmentId }),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated(data.data);
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form className="bg-white p-6 rounded shadow w-80" onSubmit={handleSubmit}>
        <h3 className="text-lg font-semibold mb-2">Create Section</h3>
        <input className="w-full mb-2 p-2 border rounded" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
        <input className="w-full mb-2 p-2 border rounded" placeholder="Slug" value={slug} onChange={e => setSlug(e.target.value)} required />
        <div className="flex gap-2 mt-2">
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded" disabled={loading}>Create</button>
          <button type="button" className="px-3 py-1 bg-gray-300 rounded" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function DepartmentSectionList({ departmentId }: { departmentId: string }) {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/department-sections?departmentId=${departmentId}`);
      const data = await res.json();
      if (res.ok) setSections(data.data || []);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchList(); }, [departmentId]);

  async function handleCreated(section: any) {
    setSections((s) => [section, ...s]);
  }

  async function confirmDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/department-sections/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setSections((s) => s.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sections</h2>
        <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => setShowCreate(true)}>Create Section</button>
      </div>
      <div className="mt-4">
        {loading && <div>Loading...</div>}
        {!loading && sections.length === 0 && <div className="text-sm text-gray-500">No sections</div>}
        <div className="mt-2 overflow-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Slug</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="p-2">{d.name}</td>
                  <td className="p-2">{d.slug}</td>
                  <td className="p-2">
                    <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => setDeletingId(d.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showCreate && <SectionForm departmentId={departmentId} onCreated={handleCreated} onClose={() => setShowCreate(false)} />}
      {deletingId && (
        <ConfirmDialog
          title="Delete Section"
          message="This will deactivate the section. Are you sure?"
          onCancel={() => setDeletingId(null)}
          onConfirm={() => confirmDelete(deletingId)}
        />
      )}
    </div>
  );
}