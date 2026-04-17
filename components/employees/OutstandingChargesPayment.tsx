'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatTablePrice } from '@/lib/formatters';

interface Charge {
  id: string;
  chargeType: string;
  amount: number;
  paidAmount: number;
  status: 'pending' | 'paid' | 'partially_paid' | 'waived' | 'cancelled';
  date: string;
  description?: string;
  dueDate?: string;
}

interface OutstandingChargesPaymentProps {
  employeeId: string;
  charges?: Charge[];
  onPaymentSuccess?: () => void;
}

export function OutstandingChargesPayment({
  employeeId,
  charges = [],
  onPaymentSuccess,
}: OutstandingChargesPaymentProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [allCharges, setAllCharges] = useState<Charge[]>(charges);
  const [selectedCharges, setSelectedCharges] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [notes, setNotes] = useState('');
  const [customPaymentAmounts, setCustomPaymentAmounts] = useState<Record<string, number>>({});

  // Fetch charges on mount
  useEffect(() => {
    fetchCharges();
  }, [employeeId]);

  const fetchCharges = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/employees/${employeeId}/charges`);
      const data = await res.json();

      if (data.success && data.data?.charges) {
        // Filter for pending/partially_paid charges
        const pendingCharges = data.data.charges.filter(
          (c: Charge) =>
            c.status === 'pending' ||
            (c.status === 'partially_paid' && c.paidAmount < c.amount)
        );
        setAllCharges(pendingCharges);
      }
    } catch (err) {
      console.error('Failed to fetch charges:', err);
      toast({ title: 'Error', description: 'Failed to load charges', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const outstandingCharges = allCharges.filter((c) => c.paidAmount < c.amount);
  const totalOutstanding = outstandingCharges.reduce(
    (sum, c) => sum + (c.amount - c.paidAmount),
    0
  );

  const selectedTotal = Array.from(selectedCharges)
    .map((id) => {
      const charge = outstandingCharges.find((c) => c.id === id);
      if (!charge) return 0;
      // Use custom amount if provided, otherwise use full outstanding amount
      const customAmount = customPaymentAmounts[id];
      return customAmount !== undefined ? customAmount : charge.amount - charge.paidAmount;
    })
    .reduce((sum, val) => sum + val, 0);

  const toggleChargeSelection = (chargeId: string) => {
    const newSelected = new Set(selectedCharges);
    if (newSelected.has(chargeId)) {
      newSelected.delete(chargeId);
    } else {
      newSelected.add(chargeId);
    }
    setSelectedCharges(newSelected);
  };

  const selectAllCharges = () => {
    if (selectedCharges.size === outstandingCharges.length) {
      setSelectedCharges(new Set());
    } else {
      setSelectedCharges(new Set(outstandingCharges.map((c) => c.id)));
    }
  };

  const handleCustomAmountChange = (chargeId: string, amount: string) => {
    const numAmount = amount === '' ? 0 : parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount < 0) {
      return; // Ignore invalid input
    }

    const charge = outstandingCharges.find((c) => c.id === chargeId);
    if (!charge) return;

    const maxAmount = charge.amount - charge.paidAmount;
    
    if (numAmount > maxAmount) {
      toast({
        title: 'Amount Exceeds Outstanding',
        description: `Maximum amount for this charge is ${formatTablePrice(Math.round(maxAmount * 100))}`,
        variant: 'destructive',
      });
      return;
    }

    setCustomPaymentAmounts({
      ...customPaymentAmounts,
      [chargeId]: numAmount,
    });
  };

  const handlePayment = async () => {
    if (selectedCharges.size === 0) {
      toast({ title: 'Error', description: 'Please select at least one charge', variant: 'destructive' });
      return;
    }

    if (!paymentMethod) {
      toast({ title: 'Error', description: 'Please select a payment method', variant: 'destructive' });
      return;
    }

    if (selectedTotal <= 0) {
      toast({ title: 'Error', description: 'Payment amount must be greater than zero', variant: 'destructive' });
      return;
    }

    setProcessing(true);

    try {
      // Prepare payment details with custom amounts
      const paymentDetails = Array.from(selectedCharges).map((chargeId) => {
        const charge = outstandingCharges.find((c) => c.id === chargeId);
        const customAmount = customPaymentAmounts[chargeId];
        const amount = customAmount !== undefined ? customAmount : (charge?.amount || 0) - (charge?.paidAmount || 0);
        
        return {
          chargeId,
          amount,
        };
      });

      const response = await fetch(`/api/employees/${employeeId}/charges/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargeIds: Array.from(selectedCharges),
          paymentDetails, // New: includes custom amounts per charge
          totalAmount: selectedTotal,
          paymentMethod,
          notes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: `Paid ${formatTablePrice(Math.round(selectedTotal * 100))} for ${selectedCharges.size} charge(s)`,
        });
        setShowDialog(false);
        setSelectedCharges(new Set());
        setCustomPaymentAmounts({});
        setNotes('');
        fetchCharges();
        onPaymentSuccess?.();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to process payment',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast({
        title: 'Error',
        description: 'Failed to process payment',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading || outstandingCharges.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-orange-900">Outstanding Charges</CardTitle>
              <CardDescription className="text-orange-700">
                Payment of charges deducted from salary or paid separately
              </CardDescription>
            </div>
            <Badge variant="destructive" className="text-lg px-3 py-1">
              {formatTablePrice(Math.round(totalOutstanding * 100))}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white rounded-lg p-4 border border-orange-200">
            <div className="space-y-3">
              {outstandingCharges.map((charge) => {
                const outstanding = charge.amount - charge.paidAmount;
                return (
                  <div
                    key={charge.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedCharges.has(charge.id)}
                        onChange={() => toggleChargeSelection(charge.id)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{charge.chargeType}</p>
                        <p className="text-xs text-gray-600">
                          {charge.description || new Date(charge.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-900">
                        {formatTablePrice(Math.round(outstanding * 100))}
                      </p>
                      {charge.paidAmount > 0 && (
                        <p className="text-xs text-gray-600">
                          ({formatTablePrice(Math.round(charge.paidAmount * 100))} paid)
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-orange-200 flex items-center justify-between">
              <button
                onClick={selectAllCharges}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {selectedCharges.size === outstandingCharges.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
              <div className="text-right">
                <p className="text-xs text-gray-600">Selected Amount:</p>
                <p className="text-lg font-bold text-orange-900">
                  {formatTablePrice(Math.round(selectedTotal * 100))}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button
              onClick={() => setShowDialog(true)}
              disabled={selectedCharges.size === 0}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Pay {selectedCharges.size > 0 ? `(${selectedCharges.size})` : ''}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Charge Payment</DialogTitle>
            <DialogDescription>
              Pay {selectedCharges.size} charge(s) totaling {formatTablePrice(Math.round(selectedTotal * 100))}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selected Charges Summary with Custom Amount Inputs */}
            <div className="bg-gray-50 p-3 rounded-lg space-y-3">
              {Array.from(selectedCharges).map((chargeId) => {
                const charge = outstandingCharges.find((c) => c.id === chargeId);
                if (!charge) return null;
                const outstanding = charge.amount - charge.paidAmount;
                const customAmount = customPaymentAmounts[chargeId];
                const payingAmount = customAmount !== undefined ? customAmount : outstanding;

                return (
                  <div key={chargeId} className="space-y-2 pb-3 border-b last:border-b-0">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-medium text-sm">{charge.chargeType}</span>
                      <span className="text-xs text-gray-500">
                        Outstanding: {formatTablePrice(Math.round(outstanding * 100))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`amount-${chargeId}`} className="text-xs">
                        Pay Amount:
                      </Label>
                      <Input
                        id={`amount-${chargeId}`}
                        type="number"
                        step="0.01"
                        min="0"
                        max={outstanding}
                        placeholder={formatTablePrice(Math.round(outstanding * 100))}
                        value={customAmount !== undefined ? customAmount : ''}
                        onChange={(e) => handleCustomAmountChange(chargeId, e.target.value)}
                        className="flex-1 h-8 text-sm"
                      />
                      <span className="text-sm font-semibold text-orange-700 min-w-max">
                        {formatTablePrice(Math.round(payingAmount * 100))}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="border-t pt-3 flex items-center justify-between font-semibold">
                <span>Total Payment:</span>
                <span className="text-lg text-orange-900">{formatTablePrice(Math.round(selectedTotal * 100))}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="Payment reference or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={processing}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
