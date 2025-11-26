'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Role {
  id: string;
  code: string;
  name: string;
}

interface RoleAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onAssign: (roleId: string, departmentId?: string) => Promise<void>;
}

export function RoleAssignmentModal({
  isOpen,
  onClose,
  userId,
  userName,
  onAssign,
}: RoleAssignmentModalProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  // Fetch available roles
  useEffect(() => {
    if (isOpen) {
      fetchRoles();
    }
  }, [isOpen]);

  const fetchRoles = async () => {
    setIsLoadingRoles(true);
    setError('');

    try {
      const response = await fetch('/api/admin/roles?limit=100', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }

      const data = await response.json();
      setRoles(data.roles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch roles');
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedRoleId) {
      setError('Please select a role');
      return;
    }

    setLoading(true);

    try {
      await onAssign(selectedRoleId, departmentId || undefined);
      setSelectedRoleId('');
      setDepartmentId('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Role</DialogTitle>
          <DialogDescription>
            Assign a role to {userName}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-700 text-sm">⚠️ {error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Role
            </label>
            {isLoadingRoles ? (
              <p className="text-sm text-gray-600">Loading roles...</p>
            ) : (
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={loading}
              >
                <option value="">-- Select a role --</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Department Selection (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department (Optional)
            </label>
            <input
              type="text"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="Leave empty for global role"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Specify a department to scope this role assignment
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedRoleId}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Assigning...' : 'Assign Role'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
