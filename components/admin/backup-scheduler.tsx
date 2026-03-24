'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BackupSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  time: string;
  daysOfWeek?: string[];
  retention: number;
}

export function BackupScheduler() {
  const [schedule, setSchedule] = useState<BackupSchedule>({
    enabled: false,
    frequency: 'daily',
    time: '02:00',
    retention: 30
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/database/schedule');
      const data = await res.json();

      if (data.success && data.data?.schedule) {
        setSchedule(data.data.schedule);
      }
    } catch (error) {
      console.error('Failed to load schedule:', error);
      toast.error('Failed to load backup schedule');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const res = await fetch('/api/admin/database/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule)
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Backup schedule saved successfully');
      } else {
        toast.error('Failed to save schedule');
      }
    } catch (error) {
      console.error('Schedule error:', error);
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup Schedule</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Automatic Backups</CardTitle>
        <CardDescription>Configure periodic database backups</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="space-y-1">
            <Label className="text-base font-medium">Enable Automatic Backups</Label>
            <p className="text-sm text-muted-foreground">
              Automatically backup database on a schedule
            </p>
          </div>
          <Switch
            checked={schedule.enabled}
            onCheckedChange={(checked) =>
              setSchedule({ ...schedule, enabled: checked })
            }
          />
        </div>

        {schedule.enabled && (
          <>
            {/* Frequency */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Backup Frequency</Label>
              <Select
                value={schedule.frequency}
                onValueChange={(value) =>
                  setSchedule({
                    ...schedule,
                    frequency: value as 'daily' | 'weekly'
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Backup Time (24-hour format)
              </Label>
              <input
                type="time"
                value={schedule.time}
                onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 02:00 (2 AM) during low traffic hours
              </p>
            </div>

            {/* Retention */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Retention Period (days)</Label>
              <input
                type="number"
                min="7"
                max="365"
                value={schedule.retention}
                onChange={(e) =>
                  setSchedule({ ...schedule, retention: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Keep backups for {schedule.retention} days before automatic deletion
              </p>
            </div>

            {/* Schedule Summary */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  {schedule.frequency === 'daily'
                    ? `Backups will run daily at ${schedule.time}`
                    : `Backups will run weekly at ${schedule.time}`}
                  {'. '}
                  Backups older than {schedule.retention} days will be removed automatically.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full"
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saving ? 'Saving...' : 'Save Schedule'}
        </Button>
      </CardContent>
    </Card>
  );
}
