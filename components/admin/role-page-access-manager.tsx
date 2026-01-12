"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { pageAccessRules, type PageAccessRule } from "@/lib/auth/page-access";

interface PageAccessGroup {
  category: string;
  pages: {
    path: string;
    rule: PageAccessRule;
    hasRole: boolean;
    requiredRoles: string[];
  }[];
}

interface RolePageAccessManagerProps {
  roleCode: string;
  roleName: string;
  onSave?: (updatedRules: Record<string, PageAccessRule>) => void;
}

/**
 * Component to manage which pages a role can access
 * Shows all available pages and whether the role has access to each
 */
export function RolePageAccessManager({
  roleCode,
  roleName,
  onSave,
}: RolePageAccessManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, string[]>>({});

  // Organize pages by category
  const pagesByCategory = useMemo(() => {
    const grouped: Record<string, PageAccessGroup["pages"]> = {};

    Object.entries(pageAccessRules).forEach(([path, rule]) => {
      // Skip wildcard patterns for display
      if (path.includes("*")) return;

      // Determine category from path
      let category = "Other";
      if (path.startsWith("/dashboard/admin")) category = "Admin";
      else if (path.startsWith("/pos")) category = "POS";
      else if (path.startsWith("/bookings")) category = "Bookings";
      else if (path.startsWith("/customers")) category = "Customers";
      else if (path.startsWith("/rooms")) category = "Rooms";
      else if (path.startsWith("/inventory")) category = "Inventory";
      else if (path.startsWith("/departments")) category = "Departments";
      else if (path.startsWith("/dashboard")) category = "Dashboard";
      else if (path.startsWith("/docs")) category = "Documentation";

      const requiredRoles = rule.requiredRoles || [];
      const hasRole = requiredRoles.includes(roleCode);

      if (!grouped[category]) grouped[category] = [];
      grouped[category].push({
        path,
        rule,
        hasRole,
        requiredRoles,
      });
    });

    return grouped;
  }, [roleCode]);

  // Filter pages by search query
  const filteredPages = useMemo(() => {
    const categories = selectedCategory ? [selectedCategory] : Object.keys(pagesByCategory);

    return categories.reduce(
      (acc, cat) => {
        const filtered = pagesByCategory[cat].filter((page) =>
          page.path.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filtered.length > 0) {
          acc[cat] = filtered;
        }
        return acc;
      },
      {} as Record<string, PageAccessGroup["pages"]>
    );
  }, [pagesByCategory, searchQuery, selectedCategory]);

  const togglePageAccess = (path: string) => {
    setChanges((prev) => {
      const current = prev[path] || pageAccessRules[path]?.requiredRoles || [];
      const updated = current.includes(roleCode)
        ? current.filter((r) => r !== roleCode)
        : [...current, roleCode];
      return { ...prev, [path]: updated };
    });
  };

  const handleSave = () => {
    if (!onSave) return;

    const updatedRules: Record<string, PageAccessRule> = {};

    Object.entries(changes).forEach(([path, roles]) => {
      updatedRules[path] = {
        ...pageAccessRules[path],
        requiredRoles: roles,
      };
    });

    onSave(updatedRules);
    setChanges({});
  };

  const hasChanges = Object.keys(changes).length > 0;
  const categories = Object.keys(pagesByCategory).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold">Page Access for {roleName}</h2>
          <p className="text-muted-foreground mt-1">
            Configure which pages members of this role can access
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <select
            value={selectedCategory || ""}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pages by Category */}
      <div className="space-y-6">
        {Object.entries(filteredPages)
          .sort(([catA], [catB]) => catA.localeCompare(catB))
          .map(([category, pages]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pages.map((page) => {
                    const isChecked =
                      changes[page.path] !== undefined
                        ? changes[page.path].includes(roleCode)
                        : page.hasRole;

                    return (
                      <div key={page.path} className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg transition cursor-pointer" onClick={() => togglePageAccess(page.path)}>
                        <input
                          type="checkbox"
                          id={page.path}
                          checked={isChecked}
                          onChange={() => togglePageAccess(page.path)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <label
                          htmlFor={page.path}
                          className="flex-1 cursor-pointer flex flex-col gap-1"
                        >
                          <span className="font-medium text-sm">{page.path}</span>
                          <div className="flex gap-2">
                            {page.rule.adminBypass && (
                              <Badge variant="secondary" className="text-xs">
                                Admin Bypass
                              </Badge>
                            )}
                            {page.rule.authenticatedOnly && (
                              <Badge variant="secondary" className="text-xs">
                                Auth Only
                              </Badge>
                            )}
                            {page.requiredRoles.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                Roles: {page.requiredRoles.join(", ")}
                              </span>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Action Buttons */}
      {hasChanges && (
        <div className="flex gap-3 justify-end sticky bottom-0 bg-background/80 backdrop-blur p-4 rounded-lg border">
          <Button variant="outline" onClick={() => setChanges({})}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            Save Changes
          </Button>
        </div>
      )}

      {/* Summary */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Pages</p>
              <p className="text-2xl font-bold">
                {Object.values(filteredPages).flat().length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role Can Access</p>
              <p className="text-2xl font-bold">
                {Object.values(filteredPages)
                  .flat()
                  .filter((p) =>
                    changes[p.path] !== undefined
                      ? changes[p.path].includes(roleCode)
                      : p.hasRole
                  ).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
