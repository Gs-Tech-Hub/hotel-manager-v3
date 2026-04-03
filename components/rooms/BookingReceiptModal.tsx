"use client";

import { POSReceipt } from "@/components/admin/pos/pos-receipt";

interface BookingData {
  id: string;
  bookingId: string;
  confirmationNo?: string;
  unit?: { roomNumber: string };
  customer: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  checkin: string;
  checkout: string;
  timeIn?: string;
  timeOut?: string;
  nights: number;
  guests: number;
  totalPrice: number;
  // Calculated charges
  extraNightsDays?: number | null;
  demurrageCharge?: number;
  demurrageChargePerDay?: number;
  totalAdditionalCharges?: number;
  totalChargesWithExtra?: number;
  bookingStatus: string;
  createdAt: string;
}

interface BookingReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingData | null;
}

export function BookingReceiptModal({
  open,
  onOpenChange,
  booking,
}: BookingReceiptModalProps) {
  if (!open || !booking) return null;

  // Transform booking data to receipt format
  const checkinDate = new Date(booking.checkin);
  const checkoutDate = new Date(booking.checkout);
  const isCheckedIn = booking.timeIn != null || booking.bookingStatus === 'checked_in' || booking.bookingStatus === 'occupied';
  const isCheckedOut = booking.timeOut != null || booking.bookingStatus === 'completed' || booking.bookingStatus === 'checked_out';

  // Build items array with room and overstay charges
  const items = [
    {
      id: `booking-${booking.id}`,
      lineId: `booking-${booking.id}`,
      name: `Room ${booking.unit?.roomNumber || 'N/A'}`,
      quantity: booking.nights,
      unitPrice: Math.round((booking.totalPrice || 0) / (booking.nights || 1)),
      lineTotal: booking.totalPrice || 0,
      productName: `Room ${booking.unit?.roomNumber || 'N/A'} (${booking.nights} nights)`,
    },
  ];

  // Add overstay charges as a line item if they exist
  if (booking.extraNightsDays && booking.extraNightsDays > 0 && booking.demurrageCharge) {
    items.push({
      id: `overstay-${booking.id}`,
      lineId: `overstay-${booking.id}`,
      name: `Overstay Charge`,
      quantity: booking.extraNightsDays,
      unitPrice: Math.round((booking.demurrageCharge || 0) / (booking.extraNightsDays || 1)),
      lineTotal: booking.demurrageCharge || 0,
      productName: `Overstay (${booking.extraNightsDays} day${booking.extraNightsDays > 1 ? 's' : ''})`,
    });
  }

  const receiptData = {
    orderNumber: booking.bookingId,
    customerName: `${booking.customer?.firstName || ''} ${booking.customer?.lastName || ''}`.trim() || 'Guest',
    createdAt: booking.createdAt,
    items,
    subtotal: booking.totalPrice || 0,
    overstayCharge: booking.demurrageCharge || 0,
    extraNightsDays: booking.extraNightsDays || 0,
    discounts: [],
    total: booking.totalChargesWithExtra || booking.totalPrice || 0,
    taxAmount: 0,
    orderTypeDisplay: 'Booking',
    isDeferred: booking.bookingStatus === 'pending',
    paymentStatus: booking.bookingStatus,
    // Booking-specific fields
    checkinDate: checkinDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
    checkoutDate: checkoutDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
    checkinTime: booking.timeIn || 'Not checked in',
    checkoutTime: booking.timeOut || 'Not checked out',
    isCheckedIn,
    isCheckedOut,
  };

  return (
    <POSReceipt
      receipt={receiptData}
      onClose={() => onOpenChange(false)}
    />
  );
}
