"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthSession } from "@/lib/auth/session";

interface AuthContextType {
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session on mount
  useEffect(() => {
    refreshSession();
  }, []);

  const refreshSession = async () => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSession(data.session);
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error("Failed to refresh session:", error);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setSession(null);
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const value: AuthContextType = {
    session,
    isLoading,
    isAuthenticated: !!session,
    logout,
    refresh: refreshSession,
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
