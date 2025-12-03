"use client";
import React, { useEffect, useState } from 'react';
import DepartmentSectionList from '../../../components/admin/DepartmentSectionList';

export default function Page() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  async function fetchDepartments() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/departments');
      const data = await res.json();
      if (res.ok) {
        setDepartments(data.data || []);
        if ((data.data || []).length > 0 && !selected) {
          setSelected((data.data || [])[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchDepartments(); }, []);

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Department Sections</h1>
      </div>

      <div className="mb-4">
        {loading && <div>Loading departments…</div>}
        {!loading && departments.length === 0 && <div className="text-sm text-gray-500">No departments found. Create a department first.</div>}
        {!loading && departments.length > 0 && (
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">Department:</label>
            <select className="p-2 border rounded" value={selected ?? ''} onChange={(e) => setSelected(e.target.value)}>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
          </div>
        )}
      </div>

      {selected && (
        <DepartmentSectionList departmentId={selected} />
      )}
    </div>
  );
}
