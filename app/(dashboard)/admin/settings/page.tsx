'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaxSettingsForm } from '@/components/admin/tax-settings-form';
import { TaxCollectionsReport } from '@/components/admin/tax-collections-report';
import { Settings, DollarSign, BarChart3 } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage system-wide configuration and settings</p>
        </div>
      </div>

      {/* Tabs for different settings sections */}
      <Tabs defaultValue="tax-settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tax-settings" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Tax Settings
          </TabsTrigger>
          <TabsTrigger value="tax-collections" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Tax Collections
          </TabsTrigger>
        </TabsList>

        {/* Tax Settings Tab */}
        <TabsContent value="tax-settings" className="space-y-6">
          <TaxSettingsForm />
        </TabsContent>

        {/* Tax Collections Report Tab */}
        <TabsContent value="tax-collections" className="space-y-6">
          <TaxCollectionsReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
