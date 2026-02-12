import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, ShoppingCart } from 'lucide-react';

interface GameCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: any;
  departmentCode: string;
  onCheckoutComplete: (data: any) => void;
}

export function GameCheckout({
  open,
  onOpenChange,
  session,
  departmentCode,
  onCheckoutComplete,
}: GameCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/departments/${departmentCode}/games/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to process checkout');
        return;
      }

      onCheckoutComplete(data.data);
      onOpenChange(false);
    } catch (err) {
      setError('An error occurred during checkout');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Game Checkout - {session.customer.firstName} {session.customer.lastName}</DialogTitle>
          <DialogDescription>
            Confirm to proceed to payment using terminal checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-4 space-y-2 border border-blue-200">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">Games Played:</span>
              <span className="font-semibold">{session.gameCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">Total Amount:</span>
              <span className="font-semibold text-lg text-green-600">
                ${Number(session.totalAmount).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Payment will be processed</p>
              <p>
                This will create an order and open the terminal checkout system to accept
                payment.
              </p>
            </div>
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
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={loading}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <ShoppingCart className="h-4 w-4" />
              {loading ? 'Processing...' : 'Proceed to Payment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
