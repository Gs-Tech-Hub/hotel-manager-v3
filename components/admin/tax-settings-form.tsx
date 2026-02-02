'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface TaxSettings {
  id: string;
  enabled: boolean;
  taxRate: number;
  appliedToSubtotal?: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export function TaxSettingsForm() {
  const [settings, setSettings] = useState<TaxSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local state for form
  const [enabled, setEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(10);

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/settings/tax');
        const data = await response.json();

        if (data.success && data.data?.settings) {
          const currentSettings = data.data.settings;
          setSettings(currentSettings);
          setEnabled(currentSettings.enabled ?? true);
          setTaxRate(currentSettings.taxRate ?? 10);
        } else {
          toast.error('Failed to load tax settings');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load tax settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validate tax rate
      if (taxRate < 0 || taxRate > 100) {
        toast.error('Tax rate must be between 0 and 100');
        return;
      }

      const response = await fetch('/api/settings/tax', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, taxRate }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSettings(data.data?.settings);
        toast.success('Tax settings updated successfully');
      } else {
        toast.error(data.message || 'Failed to update tax settings');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update tax settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setEnabled(settings.enabled ?? true);
      setTaxRate(settings.taxRate ?? 10);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tax Settings</CardTitle>
          <CardDescription>Configure system-wide tax settings</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax Settings</CardTitle>
        <CardDescription>
          Configure system-wide tax settings applied to all orders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tax Enabled Toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="tax-enabled" className="text-base font-medium">
              Enable Tax
            </Label>
            <Switch
              id="tax-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={saving}
              aria-label="Enable or disable tax calculation"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {enabled
              ? 'Tax is currently enabled and will be applied to all orders'
              : 'Tax is currently disabled. Orders will not include tax calculations'}
          </p>
        </div>

        {/* Tax Rate Input */}
        {enabled && (
          <div className="space-y-3">
            <Label htmlFor="tax-rate" className="text-base font-medium">
              Tax Rate (%)
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                disabled={saving}
                className="max-w-xs"
                placeholder="Enter tax rate"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Current tax rate: {taxRate.toFixed(2)}% - This will be applied to order subtotals
            </p>

            {/* Tax Example */}
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs font-medium text-muted-foreground mb-2">EXAMPLE:</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono">₦1,000.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({taxRate.toFixed(2)}%):</span>
                  <span className="font-mono">₦{(1000 * (taxRate / 100)).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-1 flex justify-between font-medium">
                  <span>Total:</span>
                  <span className="font-mono">₦{(1000 + 1000 * (taxRate / 100)).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
          <Button
            onClick={handleReset}
            disabled={saving}
            variant="outline"
            className="flex-1"
          >
            Reset
          </Button>
        </div>

        {/* Last Updated Info */}
        {settings?.updatedAt && (
          <div className="text-xs text-muted-foreground border-t pt-4">
            <p>Last updated: {new Date(settings.updatedAt).toLocaleString()}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
