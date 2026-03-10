/**
 * useMultipleUnitBooking Hook
 * Manage booking multiple units for a single guest
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface UnitBooking {
  unitId: string;
  checkInDate: string;
  checkOutDate: string;
  checkoutTime?: string;
  totalCents: number;
}

export interface MultipleUnitBookingState {
  guestId?: string;
  guestName?: string;
  bookings: UnitBooking[];
  totalCents: number;
}

export function useMultipleUnitBooking() {
  const { toast } = useToast();
  const [state, setState] = useState<MultipleUnitBookingState>({
    bookings: [],
    totalCents: 0,
  });

  /**
   * Add a unit booking
   */
  const addUnitBooking = useCallback(
    (booking: UnitBooking) => {
      setState(prev => {
        // Check for overlapping dates for the same unit
        const hasOverlap = prev.bookings.some(
          b =>
            b.unitId === booking.unitId &&
            new Date(booking.checkInDate) < new Date(b.checkOutDate) &&
            new Date(booking.checkOutDate) > new Date(b.checkInDate)
        );

        if (hasOverlap) {
          toast({
            title: 'Error',
            description: 'Unit already booked for overlapping dates',
            variant: 'destructive',
          });
          return prev;
        }

        return {
          ...prev,
          bookings: [...prev.bookings, booking],
          totalCents: prev.totalCents + booking.totalCents,
        };
      });
    },
    [toast]
  );

  /**
   * Remove a unit booking
   */
  const removeUnitBooking = useCallback((unitId: string, checkInDate: string) => {
    setState(prev => {
      const booking = prev.bookings.find(
        b => b.unitId === unitId && b.checkInDate === checkInDate
      );

      if (!booking) return prev;

      return {
        ...prev,
        bookings: prev.bookings.filter(
          b => !(b.unitId === unitId && b.checkInDate === checkInDate)
        ),
        totalCents: prev.totalCents - booking.totalCents,
      };
    });
  }, []);

  /**
   * Update unit booking checkout time
   */
  const updateCheckoutTime = useCallback(
    (unitId: string, checkInDate: string, checkoutTime: string) => {
      setState(prev => ({
        ...prev,
        bookings: prev.bookings.map(b =>
          b.unitId === unitId && b.checkInDate === checkInDate
            ? { ...b, checkoutTime }
            : b
        ),
      }));
    },
    []
  );

  /**
   * Set guest information
   */
  const setGuest = useCallback((guestId: string, guestName: string) => {
    setState(prev => ({
      ...prev,
      guestId,
      guestName,
    }));
  }, []);

  /**
   * Clear all bookings
   */
  const clear = useCallback(() => {
    setState({
      bookings: [],
      totalCents: 0,
    });
  }, []);

  /**
   * Get summary of bookings
   */
  const getSummary = useCallback(
    () => ({
      unitCount: state.bookings.length,
      totalNights: state.bookings.reduce((sum, b) => {
        const nights = Math.ceil(
          (new Date(b.checkOutDate).getTime() - new Date(b.checkInDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return sum + nights;
      }, 0),
      totalPrice: (state.totalCents / 100).toFixed(2),
      bookings: state.bookings,
    }),
    [state.bookings, state.totalCents]
  );

  return {
    state,
    addUnitBooking,
    removeUnitBooking,
    updateCheckoutTime,
    setGuest,
    clear,
    getSummary,
  };
}

/**
 * Hook for managing guest selection when creating multiple bookings
 */
export function useGuestSelection() {
  const [selectedGuest, setSelectedGuest] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  } | null>(null);

  const setGuest = useCallback(
    (guest: typeof selectedGuest) => {
      setSelectedGuest(guest);
    },
    []
  );

  const clearGuest = useCallback(() => {
    setSelectedGuest(null);
  }, []);

  return {
    selectedGuest,
    setGuest,
    clearGuest,
  };
}
