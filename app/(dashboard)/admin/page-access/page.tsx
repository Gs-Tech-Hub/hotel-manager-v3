"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProtectedRoute } from "@/components/protected-route";
import { RolePageAccessManager } from "@/components/admin/role-page-access-manager";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

function PageAccessContent() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Fetch roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/roles", { credentials: "include" });

        if (!res.ok) throw new Error("Failed to fetch roles");

        const data = await res.json();
        const activeRoles = (data.data || []).filter((r: Role) => r.isActive);
        setRoles(activeRoles);

        if (activeRoles.length > 0) {
          setSelectedRoleCode(activeRoles[0].code);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load roles");
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, []);

  const selectedRole = roles.find((r) => r.code === selectedRoleCode);

  const handleSavePageAccess = async (updatedRules: Record<string, any>) => {
    if (!selectedRole) return;

    try {
      setSaveStatus("saving");
      setError("");

      // Send update to API
      const response = await fetch(`/api/admin/roles/${selectedRole.id}/page-access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleCode: selectedRole.code,
          rules: updatedRules,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to save page access rules");
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaveStatus("error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading roles...</p>
        </div>
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No active roles found. Create roles first in Role Management.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Page Access Control</h1>
        <p className="text-muted-foreground mt-2">
          Manage which pages each role can access across the application
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="flex gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {saveStatus === "saved" && (
        <div className="flex gap-2 p-4 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-green-700 text-sm">Page access rules updated successfully</p>
        </div>
      )}

      {/* Role Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Role</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedRoleCode} onValueChange={setSelectedRoleCode}>
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
              {roles.map((role) => (
                <TabsTrigger key={role.code} value={role.code} className="text-xs sm:text-sm">
                  {role.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {roles.map((role) => (
              <TabsContent key={role.code} value={role.code} className="space-y-4">
                {role.description && (
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Page Access Manager */}
      {selectedRole && (
        <RolePageAccessManager
          roleCode={selectedRole.code}
          roleName={selectedRole.name}
          onSave={handleSavePageAccess}
        />
      )}
    </div>
  );
}

export default function PageAccessPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <PageAccessContent />
    </ProtectedRoute>
  );
}
