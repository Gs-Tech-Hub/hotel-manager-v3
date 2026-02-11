'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { STANDARDIZED_POSITIONS } from '@/lib/auth/position-role-mapping';

interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  permissions: Array<{
    id: string;
    action: string;
    subject?: string;
    description?: string;
  }>;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

interface EmployeeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeId?: string;
  initialData?: {
    email: string;
    firstName: string;
    lastName: string;
    username: string;
    roles: Array<{
      roleId: string;
      departmentId?: string;
    }>;
  };
}

export function EmployeeForm({
  isOpen,
  onClose,
  onSuccess,
  employeeId,
  initialData,
}: EmployeeFormProps) {
  const [step, setStep] = useState<'basic' | 'employment' | 'roles'>('basic');
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form data
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    password: '',
  });

  // Employment data
  const [employmentData, setEmploymentData] = useState({
    employmentDate: new Date().toISOString().split('T')[0],
    position: '',
    department: '',
    salary: '',
    salaryType: 'monthly',
    salaryFrequency: 'monthly',
    contractType: 'permanent',
    reportsTo: '',
    employmentStatus: 'active',
  });

  const [selectedRoles, setSelectedRoles] = useState<
    Array<{ roleId: string; departmentId?: string }>
  >([]);

  const isEditMode = !!employeeId;

  // Load roles and departments on mount
  useEffect(() => {
    if (isOpen) {
      loadRolesAndDepartments();
    }
  }, [isOpen]);

  // Initialize form with existing data
  useEffect(() => {
    if (isEditMode && initialData) {
      setFormData({
        email: initialData.email,
        username: initialData.username,
        firstName: initialData.firstName,
        lastName: initialData.lastName,
        password: '', // Don't pre-fill password on edit
      });
      setSelectedRoles(initialData.roles);
      setStep('employment'); // Go to employment step for edit
    } else {
      setFormData({
        email: '',
        username: '',
        firstName: '',
        lastName: '',
        password: '',
      });
      setEmploymentData({
        employmentDate: new Date().toISOString().split('T')[0],
        position: '',
        department: '',
        salary: '',
        salaryType: 'monthly',
        salaryFrequency: 'monthly',
        contractType: 'permanent',
        reportsTo: '',
        employmentStatus: 'active',
      });
      setSelectedRoles([]);
      setStep('basic');
    }
  }, [isEditMode, initialData]);

  const loadRolesAndDepartments = async () => {
    try {
      const [rolesRes, deptsRes] = await Promise.all([
        fetch('/api/roles?limit=100', { credentials: 'include' }),
        fetch('/api/departments?limit=100', { credentials: 'include' }),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.data || []);
      }

      if (deptsRes.ok) {
        const deptsData = await deptsRes.json();
        setDepartments(deptsData.data || []);
      }
    } catch (err) {
      console.error('Failed to load roles/departments', err);
    }
  };

  const handleBasicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.email || !formData.username) {
      setError('Email and username are required');
      return;
    }

    if (!isEditMode && !formData.password) {
      setError('Password is required for new employees');
      return;
    }

    // Basic email validation
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setStep('employment');
  };

  const handleEmploymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Optional employment data - no strict validation needed
    // Just proceed to roles step
    setStep('roles');
  };

  const handleRolesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = isEditMode
        ? `/api/employees/${employeeId}`
        : '/api/employees';
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
          // Include employment data
          ...Object.fromEntries(
            Object.entries(employmentData).map(([key, value]) => [
              key,
              value || undefined
            ])
          ),
          roles: selectedRoles,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} employee`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addRole = () => {
    setSelectedRoles([...selectedRoles, { roleId: '' }]);
  };

  const removeRole = (index: number) => {
    setSelectedRoles(selectedRoles.filter((_, i) => i !== index));
  };

  const updateRole = (
    index: number,
    roleId: string,
    departmentId?: string
  ) => {
    const updated = [...selectedRoles];
    updated[index] = { roleId, departmentId };
    setSelectedRoles(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">
            {isEditMode ? 'Edit Employee' : 'Create New Employee'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'basic' || step === 'employment' || step === 'roles' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>1</div>
            <span className="text-sm font-medium">Basic Info</span>
          </div>
          <div className="flex-1 h-1 mx-2" style={{backgroundColor: (step === 'employment' || step === 'roles') ? '#2563eb' : '#e5e7eb'}}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'employment' || step === 'roles' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>2</div>
          <span className="text-sm font-medium">Employment</span>
          <div className="flex-1 h-1 mx-2" style={{backgroundColor: step === 'roles' ? '#2563eb' : '#e5e7eb'}}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'roles' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>3</div>
          <span className="text-sm font-medium">Roles</span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">⚠️ {error}</p>
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 'basic' && (
          <form onSubmit={handleBasicSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="employee@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
                disabled={isEditMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="john.doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="John"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {!isEditMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next: Assign Roles
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Employment Data */}
        {step === 'employment' && (
          <form onSubmit={handleEmploymentSubmit} className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Employment Information (Optional)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Date
                </label>
                <input
                  type="date"
                  value={employmentData.employmentDate}
                  onChange={(e) =>
                    setEmploymentData({ ...employmentData, employmentDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <select
                  value={employmentData.position}
                  onChange={(e) =>
                    setEmploymentData({ ...employmentData, position: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Select position --</option>
                  {STANDARDIZED_POSITIONS.map((pos) => (
                    <option key={pos.id} value={pos.name}>
                      {pos.name}
                    </option>
                  ))}
                </select>
                {employmentData.position && (
                  <p className="mt-1 text-xs text-gray-500">
                    Role: {STANDARDIZED_POSITIONS.find(p => p.name === employmentData.position)?.roleCode}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  value={employmentData.department}
                  onChange={(e) =>
                    setEmploymentData({ ...employmentData, department: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Select department --</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.code}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Salary
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={employmentData.salary}
                  onChange={(e) =>
                    setEmploymentData({ ...employmentData, salary: e.target.value })
                  }
                  placeholder="e.g., 1500.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Salary Type
                </label>
                <select
                  value={employmentData.salaryType}
                  onChange={(e) =>
                    setEmploymentData({ ...employmentData, salaryType: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="hourly">Hourly</option>
                  <option value="annual">Annual</option>
                  <option value="daily">Daily</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Salary Frequency
                </label>
                <select
                  value={employmentData.salaryFrequency}
                  onChange={(e) =>
                    setEmploymentData({ ...employmentData, salaryFrequency: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contract Type
                </label>
                <select
                  value={employmentData.contractType}
                  onChange={(e) =>
                    setEmploymentData({ ...employmentData, contractType: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="permanent">Permanent</option>
                  <option value="temporary">Temporary</option>
                  <option value="contractor">Contractor</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Status
                </label>
                <select
                  value={employmentData.employmentStatus}
                  onChange={(e) =>
                    setEmploymentData({ ...employmentData, employmentStatus: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reports To (Manager ID)
                </label>
                <input
                  type="text"
                  value={employmentData.reportsTo}
                  onChange={(e) =>
                    setEmploymentData({ ...employmentData, reportsTo: e.target.value })
                  }
                  placeholder="Manager user ID (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep('basic')}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next: Assign Roles
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Roles Assignment */}
        {step === 'roles' && (
          <form onSubmit={handleRolesSubmit} className="p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Assign Roles</h3>
                <button
                  type="button"
                  onClick={addRole}
                  className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  <Plus size={16} /> Add Role
                </button>
              </div>

              <div className="space-y-4">
                {selectedRoles.length === 0 ? (
                  <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded">
                    No roles assigned. Click &quot;Add Role&quot; to assign one.
                  </p>
                ) : (
                  selectedRoles.map((roleAssignment, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 rounded-lg space-y-3"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role
                        </label>
                        <select
                          value={roleAssignment.roleId}
                          onChange={(e) =>
                            updateRole(index, e.target.value, roleAssignment.departmentId)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          required
                        >
                          <option value="">-- Select a role --</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name} ({role.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Department (Optional)
                        </label>
                        <select
                          value={roleAssignment.departmentId || ''}
                          onChange={(e) =>
                            updateRole(
                              index,
                              roleAssignment.roleId,
                              e.target.value || undefined
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">-- All departments --</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name} ({dept.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Show permissions for selected role */}
                      {roleAssignment.roleId && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-2">
                            Role Permissions ({roles.find((r) => r.id === roleAssignment.roleId)?.permissions.length || 0}):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {roles
                              .find((r) => r.id === roleAssignment.roleId)
                              ?.permissions.map((perm) => (
                                <span
                                  key={perm.id}
                                  className="inline-block px-2 py-1 bg-blue-200 text-blue-900 rounded text-xs font-medium"
                                  title={perm.description || ''}
                                >
                                  {perm.action}{perm.subject ? `/${perm.subject}` : ''}
                                </span>
                              )) || (
                              <span className="text-xs text-blue-700">No permissions assigned to this role</span>
                            )}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => removeRole(index)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-red-600 border border-red-200 rounded hover:bg-red-50"
                      >
                        <Trash2 size={16} /> Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep('employment')}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {loading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
