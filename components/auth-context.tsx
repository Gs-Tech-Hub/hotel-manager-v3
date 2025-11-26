"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  userType: "admin" | "employee";
  roles: string[];
  permissions?: string[];
  departmentId?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    validateSession();
  }, []);

  const validateSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", {
        credentials: "include",
      });

      if (res.ok) {
        const { session } = await res.json();
        // fetch permissions for session
        const permsRes = await fetch('/api/auth/permissions', { credentials: 'include' });
        let perms: string[] = [];
        if (permsRes.ok) {
          const permsJson = await permsRes.json();
          perms = permsJson.permissions || [];
        }
        setUser({ ...session, permissions: perms });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Session validation error:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        });

        if (!res.ok) {
          const { error } = await res.json();
          throw new Error(error || "Login failed");
        }

        const { user: userData } = await res.json();
        // fetch permissions after login
        const permsRes = await fetch('/api/auth/permissions', { credentials: 'include' });
        let perms: string[] = [];
        if (permsRes.ok) {
          const permsJson = await permsRes.json();
          perms = permsJson.permissions || [];
        }
        setUser({ ...userData, permissions: perms });
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const { user: userData } = await res.json();
        // refresh permissions too
        const permsRes = await fetch('/api/auth/permissions', { credentials: 'include' });
        let perms: string[] = [];
        if (permsRes.ok) {
          const permsJson = await permsRes.json();
          perms = permsJson.permissions || [];
        }
        setUser({ ...userData, permissions: perms });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Session refresh error:", error);
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      // Superuser shortcut
      if (user.userType === 'admin') return true;

      // Check cached permissions (format: action:subject or action:"")
      if (user.permissions && user.permissions.length > 0) {
        return user.permissions.includes(permission);
      }

      return false;
    },
    [user]
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      return user?.roles?.includes(role) || false;
    },
    [user]
  );

  const hasAnyRole = useCallback(
    (roles: string[]): boolean => {
      return user?.roles?.some((r) => roles.includes(r)) || false;
    },
    [user]
  );

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    logout,
    refreshSession,
    hasPermission,
    hasRole,
    hasAnyRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
