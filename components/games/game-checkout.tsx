import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, ShoppingCart, CheckCircle } from 'lucide-react';
import { formatTablePrice } from '@/lib/formatters';

interface GameCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: any;
  orderId?: string;
  departmentCode: string;
  sectionCode?: string;
  onCheckoutComplete: (data: any) => void;
}

export function GameCheckout({
  open,
  onOpenChange,
  session,
  orderId: propOrderId,
  departmentCode,
  sectionCode,
  onCheckoutComplete,
}: GameCheckoutProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Get orderId from session's orderHeaderId (now stored directly on GameSession)
  const orderId = propOrderId || session?.orderHeaderId;

  // Load order details from checkout endpoint
  useEffect(() => {
    const loadOrderDetails = async () => {
      try {
        if (!orderId) {
          console.warn('No orderId available - session may not have created order yet');
          return;
        }

        const orderUrl = sectionCode
          ? `/api/departments/${sectionCode}/games/checkout-order?orderId=${orderId}`
          : `/api/departments/${departmentCode}/games/checkout-order?orderId=${orderId}`;

        const response = await fetch(orderUrl);
        const data = await response.json();
        
        if (response.ok && data.data?.order) {
          setOrderDetails({
            tax: data.data.order.tax,
            subtotal: data.data.order.subtotal,
            discountTotal: data.data.order.discountTotal,
            total: data.data.order.total,
            orderNumber: data.data.order.orderNumber,
          });
        } else {
          console.error('Failed to load order details:', data.error?.message);
        }
      } catch (err) {
        console.error('Error loading order details:', err);
      }
    };

    if (open && orderId) {
      loadOrderDetails();
    }
  }, [open, orderId, sectionCode, departmentCode]);

  const handlePay = async () => {
    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }

    if (!orderId) {
      setError('Order information not loaded. Please try again.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const apiUrl = sectionCode
        ? `/api/departments/${sectionCode}/games/pay`
        : `/api/departments/${departmentCode}/games/pay`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          sessionId: session.id,
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to process payment');
        return;
      }

      // Show success
      setShowSuccess(true);
      
      // Call callback with payment data
      onCheckoutComplete(data.data);

      // Close dialog and refresh after a brief delay
      setTimeout(() => {
        onOpenChange(false);
        router.refresh();
      }, 1500);
    } catch (err) {
      setError('An error occurred during payment processing');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const displayTax = orderDetails?.tax || 0;
  const displaySubtotal = orderDetails?.subtotal || 0;
  const displayDiscount = orderDetails?.discountTotal || 0;
  const displayTotal = orderDetails?.total || 0;

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
              Game session closed. Customer charged {formatTablePrice(displayTotal)}.
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
          <DialogTitle>Game Checkout - {session.customer.firstName} {session.customer.lastName}</DialogTitle>
          <DialogDescription>
            Games played: {session.gameCount} | Complete payment to close session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
        {/* Order Summary */}
          <div className="rounded-lg bg-blue-50 p-4 space-y-2 border border-blue-200">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">Games Played:</span>
              <span className="font-semibold">{session.gameCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">Subtotal:</span>
              <span className="font-semibold">
                {formatTablePrice(displaySubtotal)}
              </span>
            </div>
            {displayDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-700">
                <span>Discount:</span>
                <span className="font-semibold">
                  -{formatTablePrice(displayDiscount)}
                </span>
              </div>
            )}
            {displayTax > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-blue-200">
                <span className="text-slate-700">Tax:</span>
                <span className="font-semibold">
                  {formatTablePrice(displayTax)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base pt-2 border-t border-blue-300">
              <span className="font-semibold text-slate-900">Total Due:</span>
              <span className="font-bold text-lg text-green-600">
                {formatTablePrice(displayTotal)}
              </span>
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
              <option value="bank_transfer">🏦 Bank Transfer</option>
              <option value="mobile_payment">📱 Mobile Payment</option>
            </select>
          </div>

          {/* Info */}
          <div className="rounded-md bg-sky-50 border border-sky-200 p-3 flex gap-3">
            <AlertCircle className="h-5 w-5 text-sky-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-sky-800">
              <p className="font-medium mb-1">Direct Payment</p>
              <p>
                Payment will complete immediately and the game session will be closed.
              </p>
            </div>
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
              disabled={loading || !paymentMethod}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <ShoppingCart className="h-4 w-4" />
              {loading ? 'Processing...' : `Pay ${formatTablePrice(displayTotal)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
