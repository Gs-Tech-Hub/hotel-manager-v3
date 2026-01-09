"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from '@/components/protected-route';

interface Permission {
  id: string;
  action: string;
  subject?: string;
  description?: string;
}

interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  permissions: Permission[];
  createdAt: string;
}

function RolesManagementContent() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    permissionIds: [] as string[],
  });

  // Fetch roles and permissions
  const fetchData = async (page = 1) => {
    setLoading(true);
    setError('');

    try {
      const rolesRes = await fetch(`/api/roles?page=${page}&limit=10`, { 
        credentials: 'include' 
      });

      if (rolesRes.status === 401) {
        router.push('/login');
        return;
      }

      if (!rolesRes.ok) throw new Error('Failed to fetch roles');

      const rolesData = await rolesRes.json();

      setRoles(rolesData.data || []);
      
      // Extract all unique permissions from all roles
      const allPerms = new Map<string, Permission>();
      (rolesData.data || []).forEach((role: any) => {
        (role.permissions || []).forEach((perm: Permission) => {
          const key = `${perm.action}:${perm.subject || ''}`;
          if (!allPerms.has(key)) {
            allPerms.set(key, perm);
          }
        });
      });
      
      const permissionsList = Array.from(allPerms.values());
      console.log(`[Roles] Fetched ${rolesData.data?.length || 0} roles, extracted ${permissionsList.length} unique permissions`);
      setPermissions(permissionsList);
      setCurrentPage(rolesData.pagination.page);
      setTotalPages(rolesData.pagination.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('[Roles] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create or update role
  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save role');
      }

      setFormData({
        code: '',
        name: '',
        description: '',
        permissionIds: [],
      });
      setEditingRole(null);
      setShowCreateModal(false);
      fetchData(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    }
  };

  // Delete role
  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to deactivate this role?')) return;

    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete role');
      }

      fetchData(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  const togglePermission = (permId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permId)
        ? prev.permissionIds.filter((id) => id !== permId)
        : [...prev.permissionIds, permId],
    }));
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
          <p className="text-gray-600 mt-1">Manage roles and permissions</p>
        </div>
        <button
          onClick={() => {
            setEditingRole(null);
            setFormData({
              code: '',
              name: '',
              description: '',
              permissionIds: [],
            });
            setShowCreateModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
        >
          + Create Role
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">⚠️ {error}</p>
        </div>
      )}

      {/* Roles Grid */}
      <div className="grid gap-6">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading roles...</p>
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No roles found</p>
          </div>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{role.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                  <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
                    role.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {role.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => {
                      setEditingRole(role);
                      setFormData({
                        code: role.code,
                        name: role.name,
                        description: role.description,
                        permissionIds: role.permissions.map((p) => p.id),
                      });
                      setShowCreateModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Edit
                  </button>
                  {role.isActive && (
                    <button
                      onClick={() => handleDeleteRole(role.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>

              {/* Permissions */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">Permissions:</p>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.length === 0 ? (
                    <p className="text-xs text-gray-500">No permissions assigned</p>
                  ) : (
                    role.permissions.map((perm) => (
                      <span
                        key={perm.id}
                        className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                      >
                        {perm.action}{perm.subject ? `/${perm.subject}` : ''}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => fetchData(page)}
              className={`px-3 py-1 rounded ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingRole ? 'Edit Role' : 'Create New Role'}
            </h2>

            <form onSubmit={handleSubmitRole} className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., ADMIN, MANAGER"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                  disabled={!!editingRole}
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Administrator"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Role description..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                />
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Permissions</label>
                    <p className="text-xs text-gray-500">Select permissions this role can perform ({formData.permissionIds.length} selected)</p>
                  </div>
                  <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
                    Total: {permissions.length}
                  </div>
                </div>
                
                {permissions.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">⚠️ No permissions available. Please seed permissions first.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Selected Permissions Summary */}
                    {formData.permissionIds.length > 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs font-medium text-green-800 mb-2">Selected Permissions ({formData.permissionIds.length}):</p>
                        <div className="flex flex-wrap gap-1">
                          {permissions
                            .filter(p => formData.permissionIds.includes(p.id))
                            .map(p => (
                              <span key={p.id} className="inline-block px-2 py-1 bg-green-200 text-green-800 rounded text-xs font-medium">
                                {p.action}{p.subject ? `/${p.subject}` : ''}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Permissions Grid */}
                    <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto border border-gray-200 p-3 rounded-lg bg-gray-50">
                      {permissions
                        .sort((a, b) => `${a.action}/${a.subject}`.localeCompare(`${b.action}/${b.subject}`))
                        .map((perm) => {
                          const isChecked = formData.permissionIds.includes(perm.id);
                          return (
                            <label 
                              key={perm.id} 
                              className={`flex items-start gap-2 p-2 rounded cursor-pointer transition ${
                                isChecked 
                                  ? 'bg-blue-100 border border-blue-300' 
                                  : 'hover:bg-gray-100 border border-transparent'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(perm.id)}
                                className="w-4 h-4 rounded border-gray-300 cursor-pointer mt-0.5 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm font-medium block ${isChecked ? 'text-blue-900' : 'text-gray-700'}`}>
                                  {perm.action}{perm.subject ? `/${perm.subject}` : ''}
                                </span>
                                {perm.description && (
                                  <span className="text-xs text-gray-600 block mt-0.5">{perm.description}</span>
                                )}
                              </div>
                            </label>
                          );
                        })
                    }
                    </div>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingRole ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RolesManagementPageWrapper() {
  return (
    <ProtectedRoute requiredRole="admin">
      <RolesManagementContent />
    </ProtectedRoute>
  );
}
