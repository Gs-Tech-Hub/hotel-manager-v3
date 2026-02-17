import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, ShoppingCart } from 'lucide-react';
import { formatTablePrice } from '@/lib/formatters';

interface GameCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: any;
  departmentCode: string;
  sectionCode?: string; // Optional section code (format: department:section)
  onCheckoutComplete: (data: any) => void;
}

export function GameCheckout({
  open,
  onOpenChange,
  session,
  departmentCode,
  sectionCode,
  onCheckoutComplete,
}: GameCheckoutProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    setError('');
    setLoading(true);

    try {
      // Determine API endpoint: if sectionCode provided, use section-style code format
      const apiUrl = sectionCode
        ? `/api/departments/${sectionCode}/games/checkout`
        : `/api/departments/${departmentCode}/games/checkout`;

      const response = await fetch(apiUrl, {
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

      // Redirect to the terminal-specific checkout if terminal is assigned
      if (data.data.redirectUrl) {
        router.push(data.data.redirectUrl);
      }
    } catch (err) {
      setError('An error occurred during checkout');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate amount in cents based on service pricing
  let calculatedAmountCents = 0;
  if (session.service && session.service.pricingModel === 'per_count') {
    const priceInCents = Number(session.service.pricePerCount || 0) * 100;
    calculatedAmountCents = Math.round(priceInCents * session.gameCount);
  } else if (session.service && session.service.pricingModel === 'per_time') {
    const minutesPerUnit = 15;
    const totalMinutes = session.gameCount * minutesPerUnit;
    const priceInCents = Number(session.service.pricePerMinute || 0) * 100;
    calculatedAmountCents = Math.round(priceInCents * totalMinutes);
  }

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
                {formatTablePrice(calculatedAmountCents)}
              </span>
            </div>
          </div>

          <div className="rounded-md bg-sky-50 border border-sky-200 p-3 space-y-2">
            <div className="text-sm">
              <span className="text-slate-700 font-medium">Section:</span>
              <span className="text-slate-900 ml-2">{session.section?.name}</span>
            </div>
            {session.service && (
              <div className="text-sm">
                <span className="text-slate-700 font-medium">Service:</span>
                <span className="text-slate-900 ml-2">{session.service.name}</span>
              </div>
            )}
          </div>

          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Payment will be processed</p>
              <p>
                This will prepare the order for payment. The terminal checkout system will
                handle tax, discounts, and payment processing.
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
