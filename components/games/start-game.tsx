import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface StartGameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  gameSections: any[]; // Game sections (not game types)
  departmentCode: string;
  sectionCode?: string; // Optional section code (format: department:section)
  defaultSection?: any; // Default section to pre-select
  onGameStarted: (session: any) => void;
}

export function StartGame({
  open,
  onOpenChange,
  customer,
  gameSections = [],
  departmentCode,
  sectionCode,
  defaultSection,
  onGameStarted,
}: StartGameProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Since sections are now game type identifiers, we use the section ID as gameTypeId
  // No need to fetch separately
  const handleStartGame = async () => {
    if (!defaultSection?.id) {
      setError('Game section data not loaded. Please wait...');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // departmentCode is already in the format "parent:section" or just "parent"
      // If it contains a colon, use it as-is; otherwise append the section ID
      const sectionCode = departmentCode.includes(':') 
        ? departmentCode 
        : `${departmentCode}:${defaultSection.slug || defaultSection.id}`;
      
      // Section name is the game type identifier - only pass customerId
      const response = await fetch(`/api/departments/${sectionCode}/games/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to start game');
        return;
      }

      onGameStarted(data.data.session);
      setIsOpen(false);
    } catch (err) {
      setError('An error occurred while starting the game');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Game for {customer.firstName} {customer.lastName}</DialogTitle>
          <DialogDescription>
            Game section is automatically selected. Click below to start.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Game Section</label>
            {defaultSection?.id ? (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 border border-green-200">
                ✓ Selected: <span className="font-semibold">{defaultSection.name}</span>
              </div>
            ) : (
              <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-700 border border-yellow-200">
                Loading section data...
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleStartGame} disabled={loading || !defaultSection?.id}>
              {loading ? 'Starting...' : 'Start Game'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
