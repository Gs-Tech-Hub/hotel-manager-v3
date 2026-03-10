/**
 * Reservation Form Component
 * Guest information and booking confirmation with validation
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
import { formatPriceDisplay, formatTablePrice } from '@/lib/formatters';
import { validateGuestCreation } from '@/src/lib/booking-validation';
import type { GuestCreationInput } from '@/src/lib/booking-validation';

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

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  country?: string;
  notes?: string;
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
    idNumber: '',
    country: '',
    notes: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form data using Zod schema
    const validation = validateGuestCreation({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      idNumber: formData.idNumber || undefined,
      country: formData.country || undefined,
      notes: formData.notes || undefined,
    });

    if (!validation.valid && validation.errors) {
      // Map Zod errors to form field errors
      const formErrors: FormErrors = {};
      Object.entries(validation.errors).forEach(([key, message]) => {
        formErrors[key as keyof FormErrors] = message as string;
      });
      setErrors(formErrors);

      toast({
        title: 'Validation Error',
        description: 'Please fix the errors below',
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
        idNumber: '',
        country: '',
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

  const checkIn = new Date(checkInDate).toLocaleDateString();
  const checkOut = new Date(checkOutDate).toLocaleDateString();

  // Calculate number of nights
  const nights = Math.ceil(
    (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guest Information</CardTitle>
        <CardDescription>
          Room {unitNumber} • {checkIn} to {checkOut} ({nights} night{nights !== 1 ? 's' : ''})
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                disabled={isLoading}
                placeholder="John"
                className={errors.firstName ? 'border-red-500' : ''}
              />
              {errors.firstName && (
                <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                disabled={isLoading}
                placeholder="Doe"
                className={errors.lastName ? 'border-red-500' : ''}
              />
              {errors.lastName && (
                <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              disabled={isLoading}
              placeholder="john@example.com"
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Phone <span className="text-red-500">*</span>
            </label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              disabled={isLoading}
              placeholder="+1 (555) 123-4567"
              className={errors.phone ? 'border-red-500' : ''}
            />
            {errors.phone && (
              <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">ID/Passport Number</label>
              <Input
                type="text"
                value={formData.idNumber}
                onChange={(e) => handleChange('idNumber', e.target.value)}
                disabled={isLoading}
                placeholder="Passport or ID number"
                className={errors.idNumber ? 'border-red-500' : ''}
              />
              {errors.idNumber && (
                <p className="text-red-500 text-xs mt-1">{errors.idNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Country</label>
              <Input
                type="text"
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                disabled={isLoading}
                placeholder="Country"
                className={errors.country ? 'border-red-500' : ''}
              />
              {errors.country && (
                <p className="text-red-500 text-xs mt-1">{errors.country}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Special Requests</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              disabled={isLoading}
              placeholder="Any special requests or notes..."
              rows={3}
              className={errors.notes ? 'border-red-500' : ''}
            />
            {errors.notes && (
              <p className="text-red-500 text-xs mt-1">{errors.notes}</p>
            )}
          </div>

          <div className="border-t pt-4">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Price per night:</span>
                <span>{formatPriceDisplay(Math.round(totalCents / nights))}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Number of nights:</span>
                <span>{nights}</span>
              </div>
              <div className="flex justify-between mb-2 text-lg font-bold border-t pt-2">
                <span>Total Amount</span>
                <span className="text-blue-600">{formatPriceDisplay(totalCents)}</span>
              </div>
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
