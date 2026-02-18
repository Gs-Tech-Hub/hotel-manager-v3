import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { formatTablePrice } from '@/lib/formatters';

interface OrderPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  departmentCode: string;
  onPaymentComplete: (data: any) => void;
}

export function OrderPaymentDialog({
  open,
  onOpenChange,
  order,
  departmentCode,
  onPaymentComplete,
}: OrderPaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [taxSettings, setTaxSettings] = useState<any>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(order?.amountDue || 0);

  useEffect(() => {
    if (open && order) {
      setPaymentAmount(order.amountDue || 0);
      setError('');
    }
  }, [open, order]);

  const handlePay = async () => {
    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }

    if (!paymentAmount || paymentAmount <= 0) {
      setError('Payment amount must be greater than 0');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Determine if this is a games order by checking department
      // Games orders will have specific metadata or be from games department
      const isGamesOrder = order.departmentCodes?.includes('games') || 
                          order.departmentCodes?.some((c: string) => c.toLowerCase().includes('game'));

      if (isGamesOrder && order.sessionId) {
        // Use games payment endpoint
        const response = await fetch(
          `/api/departments/${departmentCode}/games/pay`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: order.id,
              sessionId: order.sessionId,
              paymentMethod,
              amountPaid: paymentAmount,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          setError(data.error?.message || 'Failed to process payment');
          return;
        }

        setShowSuccess(true);
        onPaymentComplete(data.data);

        setTimeout(() => {
          onOpenChange(false);
          window.location.reload();
        }, 1500);
      } else {
        // Use regular order payment endpoint
        const response = await fetch(`/api/orders/${order.id}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: paymentAmount,
            paymentTypeId: 'payment-type-id', // This would need to be looked up
            paymentMethod,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error?.message || 'Failed to process payment');
          return;
        }

        setShowSuccess(true);
        onPaymentComplete(data.data);

        setTimeout(() => {
          onOpenChange(false);
          window.location.reload();
        }, 1500);
      }
    } catch (err) {
      setError('An error occurred during payment processing');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Successful</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Payment Processed</h3>
            <p className="text-gray-600">
              Order {order.orderNumber} has been paid successfully.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
          <DialogDescription>
            Order {order.orderNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="rounded-lg bg-blue-50 p-4 space-y-2 border border-blue-200">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">Customer:</span>
              <span className="font-semibold">{order.customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">Order Total:</span>
              <span className="font-semibold">
                {formatTablePrice(order.total)}
              </span>
            </div>
            {order.totalPaid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">Already Paid:</span>
                <span className="font-semibold text-green-600">
                  {formatTablePrice(order.totalPaid)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base pt-2 border-t border-blue-300">
              <span className="font-semibold text-slate-900">Due:</span>
              <span className="font-bold text-lg text-red-600">
                {formatTablePrice(order.amountDue)}
              </span>
            </div>
          </div>

          {/* Payment Amount */}
          <div>
            <label className="block text-sm font-semibold mb-2">Payment Amount ($)</label>
            <input
              type="number"
              value={(paymentAmount / 100).toFixed(2)}
              onChange={(e) => setPaymentAmount(Math.round(Number(e.target.value) * 100))}
              max={(order.amountDue / 100).toFixed(2)}
              step="0.01"
              disabled={loading}
              className="w-full border rounded px-3 py-2"
            />
            <div className="text-xs text-gray-600 mt-1">
              Max: {formatTablePrice(order.amountDue)}
            </div>
          </div>

          {/* Payment Method Selection */}
          <div>
            <label className="block text-sm font-semibold mb-2">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={loading}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">-- Select Method --</option>
              <option value="cash">💵 Cash</option>
              <option value="card">💳 Card</option>
              <option value="check">🏦 Check</option>
              <option value="bank_transfer">🏦 Bank Transfer</option>
              <option value="mobile_payment">📱 Mobile Payment</option>
            </select>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePay}
              disabled={loading || !paymentMethod || paymentAmount <= 0}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Processing...' : `Pay ${formatTablePrice(paymentAmount)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
