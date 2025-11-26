'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';

interface SessionInfo {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
  roles: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  departmentId?: string;
  issuedAt: string;
  expiresAt: string;
}

export default function SessionsPage() {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  // Fetch session info
  const fetchSessionInfo = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/validate', {
        credentials: 'include',
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }

      const data = await response.json();
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch session');
    } finally {
      setLoading(false);
    }
  };

  // Refresh token
  const handleRefreshToken = async () => {
    setIsRefreshing(true);
    setError('');

    try {
      await refreshSession();
      setLastRefresh(new Date().toLocaleTimeString());
      await fetchSessionInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh session');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessionInfo();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Session Management</h1>
          <p className="text-gray-600 mt-1">View and manage your current session</p>
        </div>
        <button
          onClick={handleRefreshToken}
          disabled={isRefreshing}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh Token'}
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">⚠️ {error}</p>
        </div>
      )}

      {/* Session Cards */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading session...</p>
        </div>
      ) : session ? (
        <div className="grid gap-6">
          {/* User Info Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">User Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="text-lg font-semibold text-gray-900">
                  {session.firstName} {session.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-lg font-semibold text-gray-900">{session.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">User Type</p>
                <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                  session.userType === 'admin'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {session.userType === 'admin' ? '👑 Administrator' : '👤 Employee'}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">User ID</p>
                <p className="text-lg font-semibold text-gray-900 font-mono text-xs">{session.userId}</p>
              </div>
            </div>
          </div>

          {/* Roles Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Assigned Roles</h2>
            {session.roles.length === 0 ? (
              <p className="text-gray-600">No roles assigned</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {session.roles.map((role) => (
                  <div key={role.id} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{role.name}</p>
                      <p className="text-sm text-gray-600">Code: {role.code}</p>
                    </div>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session Timing Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Session Timing</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Issued At</p>
                <p className="font-semibold text-gray-900">
                  {new Date(session.issuedAt).toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Expires At</p>
                <p className="font-semibold text-gray-900">
                  {new Date(session.expiresAt).toLocaleString()}
                </p>
              </div>
            </div>
            {lastRefresh && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Last Refresh</p>
                <p className="font-semibold text-gray-900">{lastRefresh}</p>
              </div>
            )}
          </div>

          {/* Department Info (if applicable) */}
          {session.departmentId && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Department</h2>
              <p className="text-lg font-semibold text-gray-900">{session.departmentId}</p>
            </div>
          )}

          {/* Security Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-blue-900 mb-4">🔐 Security Information</h2>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>✅ Your session is stored securely in HTTP-only cookies</li>
              <li>✅ Session tokens are validated on every request</li>
              <li>✅ Access tokens expire after 1 hour</li>
              <li>✅ Use the Refresh Token button to extend your session</li>
              <li>✅ Logout clears all session data</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600">No session available</p>
        </div>
      )}
    </div>
  );
}
