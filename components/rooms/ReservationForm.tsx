/**
 * Reservation Form Component
 * Guest information and booking confirmation
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { formatTablePrice } from '@/lib/formatters';

export interface ReservationFormProps {
  unitId: string;
  unitNumber: string;
  checkInDate: string;
  checkOutDate: string;
  totalCents: number;
  onSubmit: (data: {
    unitId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    notes?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function ReservationForm({
  unitId,
  unitNumber,
  checkInDate,
  checkOutDate,
  totalCents,
  onSubmit,
  isLoading = false,
}: ReservationFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onSubmit({
        unitId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        notes: formData.notes || undefined,
      });

      toast({
        title: 'Success',
        description: 'Reservation created successfully',
      });

      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        notes: '',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create reservation',
        variant: 'destructive',
      });
    }
  };

  const total = (totalCents / 100).toFixed(2);
  const checkIn = new Date(checkInDate).toLocaleDateString();
  const checkOut = new Date(checkOutDate).toLocaleDateString();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guest Information</CardTitle>
        <CardDescription>
          Room {unitNumber} • {checkIn} to {checkOut}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">First Name *</label>
              <Input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                disabled={isLoading}
                placeholder="John"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Last Name *</label>
              <Input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                disabled={isLoading}
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email *</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={isLoading}
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone *</label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={isLoading}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Special Requests</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={isLoading}
              placeholder="Any special requests or notes..."
              rows={3}
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between mb-4 text-lg font-bold">
              <span>Total Amount</span>
              <span>{formatTablePrice(totalCents)}</span>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Processing...' : 'Confirm Reservation'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
