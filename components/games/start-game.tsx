import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';

interface StartGameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  gameTypes: any[];
  departmentCode: string;
  onGameStarted: (session: any) => void;
}

export function StartGame({
  open,
  onOpenChange,
  customer,
  gameTypes,
  departmentCode,
  onGameStarted,
}: StartGameProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState('');
  const [error, setError] = useState('');

  const handleStartGame = async () => {
    if (!selectedGameType) {
      setError('Please select a game type');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/departments/${departmentCode}/games/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          gameTypeId: selectedGameType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to start game');
        return;
      }

      onGameStarted(data.data.session);
      setSelectedGameType('');
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
            Select the game type to start playing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Game Type</label>
            <Select value={selectedGameType} onValueChange={setSelectedGameType}>
              <SelectTrigger disabled={loading}>
                <SelectValue placeholder="Select a game type..." />
              </SelectTrigger>
              <SelectContent>
                {gameTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name} - ${Number(type.pricePerGame).toFixed(2)} per game
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button onClick={handleStartGame} disabled={loading || !selectedGameType}>
              {loading ? 'Starting...' : 'Start Game'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
