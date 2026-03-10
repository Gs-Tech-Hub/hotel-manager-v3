/**
 * Booking Status Utilities
 * Separate guest status (check-in/out) from payment status
 */

export type GuestStatus = 'pending' | 'checked-in' | 'checked-out' | 'overstayed';
export type PaymentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type RoomAvailabilityStatus = 'available' | 'reserved' | 'occupied';

/**
 * Calculate guest status based on actual check-in/check-out times
 * @param timeIn - Actual check-in time (when guest physically checked in)
 * @param timeOut - Actual check-out time (when guest physically checked out)
 * @returns Guest status: pending, checked-in, checked-out, or overstayed
 */
export function getGuestStatus(timeIn?: Date | string | null, timeOut?: Date | string | null): GuestStatus {
  // Guest hasn't checked in yet
  if (!timeIn) {
    return 'pending';
  }

  // Guest has checked in but not checked out yet
  if (timeIn && !timeOut) {
    return 'checked-in';
  }

  // Guest has checked out
  if (timeOut) {
    return 'checked-out';
  }

  return 'pending';
}

/**
 * Get display color for guest status badge
 */
export function getGuestStatusColor(status: GuestStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'checked-in':
      return 'bg-green-100 text-green-800';
    case 'checked-out':
      return 'bg-blue-100 text-blue-800';
    case 'overstayed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get display label for guest status
 */
export function getGuestStatusLabel(status: GuestStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending Check-in';
    case 'checked-in':
      return 'Checked In';
    case 'checked-out':
      return 'Checked Out';
    case 'overstayed':
      return 'Overstayed';
    default:
      return 'Unknown';
  }
}

/**
 * Determine if a room should be unavailable for new bookings
 * Based on existing booking's check-in date and payment status
 * 
 * Rules:
 * - If payment is made AND check-in date is today/past: room is OCCUPIED (unavailable)
 * - If payment is made AND check-in date is future: room is RESERVED (unavailable)
 * - If payment is NOT made: room is AVAILABLE for new bookings
 * 
 * @param checkinDate - Check-in date of existing booking
 * @param checkoutDate - Check-out date of existing booking
 * @param isPaymentMade - Whether payment has been completed
 * @returns Room availability status for new bookings
 */
export function getRoomAvailabilityStatus(
  checkinDate: Date | string,
  checkoutDate: Date | string,
  isPaymentMade: boolean
): RoomAvailabilityStatus {
  // If no payment made, room is still available
  if (!isPaymentMade) {
    return 'available';
  }

  const now = new Date();
  const checkIn = new Date(checkinDate);
  const checkOut = new Date(checkoutDate);

  // Check-in reached or passed: room is occupied
  if (now >= checkIn) {
    return 'occupied';
  }

  // Check-in is in future: room is reserved
  if (now < checkIn) {
    return 'reserved';
  }

  return 'available';
}

/**
 * Get display color for room availability badge
 */
export function getRoomAvailabilityColor(status: RoomAvailabilityStatus): string {
  switch (status) {
    case 'available':
      return 'bg-green-100 text-green-800';
    case 'reserved':
      return 'bg-yellow-100 text-yellow-800';
    case 'occupied':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get display label for room availability status
 */
export function getRoomAvailabilityLabel(status: RoomAvailabilityStatus): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'reserved':
      return 'Reserved';
    case 'occupied':
      return 'Occupied';
    default:
      return 'Unknown';
  }
}
