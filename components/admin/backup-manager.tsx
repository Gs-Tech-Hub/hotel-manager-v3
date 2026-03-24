'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Loader2, Download, RotateCcw, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Backup {
  name: string;
  size: number;
  sizeMB: string;
  created: string;
  path: string;
}

interface BackupManagerProps {
  onBackupComplete?: () => void;
}

export function BackupManager({ onBackupComplete }: BackupManagerProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Load backups on mount
  useEffect(() => {
    loadBackups();
  }, []);

  async function loadBackups() {
    try {
      setListLoading(true);
      const res = await fetch('/api/admin/database/backups');
      const data = await res.json();

      if (data.success && data.data?.backups) {
        setBackups(data.data.backups);
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
      toast.error('Failed to load backups');
    } finally {
      setListLoading(false);
    }
  }

  async function handleCreateBackup() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/database/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'manual-backup' })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Backup created successfully');
        loadBackups();
        onBackupComplete?.();
      } else {
        toast.error(data.error?.message || 'Failed to create backup');
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('Failed to create backup');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    if (!selectedBackup) return;

    try {
      setRestoreLoading(true);
      const res = await fetch('/api/admin/database/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupFile: selectedBackup.name })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Database restored successfully. Please refresh the page.');
        setShowRestoreDialog(false);
        setSelectedBackup(null);
      } else {
        toast.error(data.error?.message || 'Failed to restore backup');
      }
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('Failed to restore backup');
    } finally {
      setRestoreLoading(false);
    }
  }

  async function handleDeleteBackup(backup: Backup) {
    try {
      // Delete via filesystem - you can add an API endpoint for this
      toast.info('Delete functionality requires manual removal from backups/ directory');
    } catch (error) {
      toast.error('Failed to delete backup');
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with Create Backup Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Database Backups</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage complete database backups
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadBackups}
            variant="outline"
            size="sm"
            disabled={listLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={handleCreateBackup}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {loading ? 'Creating...' : 'Create Backup'}
          </Button>
        </div>
      </div>

      {/* Backups List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Backups</CardTitle>
          <CardDescription>
            {backups.length === 0
              ? 'No backups yet. Create one to get started.'
              : `${backups.length} backup${backups.length !== 1 ? 's' : ''} available`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No backups available yet</p>
              <p className="text-sm mt-2">Click &quot;Create Backup&quot; to generate one</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {backups.map((backup) => (
                <div
                  key={backup.name}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm truncate">{backup.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(backup.created)} • {backup.sizeMB} MB
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={() => {
                        setSelectedBackup(backup);
                        setShowRestoreDialog(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="gap-1"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span className="hidden sm:inline">Restore</span>
                    </Button>
                    <Button
                      onClick={() => handleDeleteBackup(backup)}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive/90"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Restore Database</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Are you sure you want to restore from this backup?</p>
            <p className="font-mono text-xs bg-muted p-2 rounded">
              {selectedBackup?.name}
            </p>
            <p className="text-amber-600 font-semibold">
              ⚠️ This will overwrite all current database data. This action cannot be undone!
            </p>
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel disabled={restoreLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={restoreLoading}
              className="gap-2 bg-destructive hover:bg-destructive/90"
            >
              {restoreLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {restoreLoading ? 'Restoring...' : 'Restore Backup'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
