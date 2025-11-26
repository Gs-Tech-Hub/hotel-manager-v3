'use client';

import { useAuth } from '@/components/auth-context';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredPermission?: string;
  requiredPermissions?: string[];
  fallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  requiredPermissions,
  fallback,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, hasRole, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Check role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don't have the required role to access this page.</p>
            <p className="text-sm text-gray-500 mt-1">Required role: {requiredRole}</p>
          </div>
        </div>
      )
    );
  }

  // Check permission requirement
  // Single permission check (backwards compatible)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don't have the required permission to access this page.</p>
            <p className="text-sm text-gray-500 mt-1">Required permission: {requiredPermission}</p>
          </div>
        </div>
      )
    );
  }

  // Multiple permissions: require ALL provided permissions to be present
  if (requiredPermissions && requiredPermissions.length > 0) {
    const allowedAll = requiredPermissions.every((perm) => hasPermission(perm));
    if (!allowedAll) {
      return (
        fallback || (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
              <p className="text-gray-600 mt-2">You don't have the required permissions to access this page.</p>
              <p className="text-sm text-gray-500 mt-1">Required permissions: {requiredPermissions.join(', ')}</p>
            </div>
          </div>
        )
      );
    }
  }

  return <>{children}</>;
}
