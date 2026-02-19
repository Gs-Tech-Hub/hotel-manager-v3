"use client";

import { ProtectedRoute } from '@/components/protected-route';
import { UsersManagement } from '@/components/admin/users-management';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: 'admin' | 'employee';
  isActive: boolean;
  createdAt: string;
}

export default function UsersManagementPageWrapper() {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage admin and employee users</p>
        </div>
        <UsersManagement />
      </div>
    </ProtectedRoute>
  );
}
