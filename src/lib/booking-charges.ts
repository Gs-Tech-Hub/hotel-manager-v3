/**
 * Booking Charges Calculation
 * Calculate early check-in fees and demurrage charges for bookings
 */

/**
 * Calculate premature check-in details
 * @param scheduledCheckIn - Scheduled check-in date/time
 * @param actualCheckInTime - Actual check-in date/time (ISO string)
 * @returns Object with prematureCheckInDays and whether there's an early check-in
 */
export function calculatePrematureCheckIn(
  scheduledCheckIn: Date | string,
  actualCheckInTime: string | null | undefined
): {
  prematureCheckInDays: number | null;
  hasPrematureCheckIn: boolean;
} {
  if (!actualCheckInTime) {
    return { prematureCheckInDays: null, hasPrematureCheckIn: false };
  }

  const scheduled = new Date(scheduledCheckIn);
  const actual = new Date(actualCheckInTime);

  // Reset times to start of day for accurate day comparison
  scheduled.setHours(0, 0, 0, 0);
  actual.setHours(0, 0, 0, 0);

  const timeDiff = scheduled.getTime() - actual.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  if (daysDiff > 0) {
    return { prematureCheckInDays: daysDiff, hasPrematureCheckIn: true };
  }

  return { prematureCheckInDays: null, hasPrematureCheckIn: false };
}

/**
 * Calculate demurrage (extra stay/late checkout) details
 * @param scheduledCheckOut - Scheduled check-out date/time
 * @param actualCheckOutTime - Actual check-out date/time (ISO string)
 * @param pricePerNight - Price per night in cents
 * @returns Object with extra nights, demurrage charge details
 */
export function calculateDemurrage(
  scheduledCheckOut: Date | string,
  actualCheckOutTime: string | null | undefined,
  pricePerNight: number
): {
  extraNightsDays: number | null;
  hasExtraStay: boolean;
  demurrageChargePerDay: number;
  demurrageCharge: number;
} {
  if (!actualCheckOutTime) {
    return {
      extraNightsDays: null,
      hasExtraStay: false,
      demurrageChargePerDay: pricePerNight,
      demurrageCharge: 0,
    };
  }

  const scheduled = new Date(scheduledCheckOut);
  const actual = new Date(actualCheckOutTime);

  // Reset times to start of day for accurate day comparison
  scheduled.setHours(0, 0, 0, 0);
  actual.setHours(0, 0, 0, 0);

  const timeDiff = actual.getTime() - scheduled.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  if (daysDiff > 0) {
    const demurrageCharge = daysDiff * pricePerNight;
    return {
      extraNightsDays: daysDiff,
      hasExtraStay: true,
      demurrageChargePerDay: pricePerNight,
      demurrageCharge,
    };
  }

  return {
    extraNightsDays: null,
    hasExtraStay: false,
    demurrageChargePerDay: pricePerNight,
    demurrageCharge: 0,
  };
}

/**
 * Calculate total charges including original price and all additional charges
 * @param originalPrice - Original booking price in cents
 * @param prematureCheckInFee - Fee for early check-in (0 if none)
 * @param demurrageCharge - Demurrage/late stay charge
 * @returns Object with total additional charges and grand total
 */
export function calculateTotalCharges(
  originalPrice: number,
  prematureCheckInFee: number = 0,
  demurrageCharge: number = 0
): {
  totalAdditionalCharges: number;
  totalChargesWithExtra: number;
} {
  const totalAdditionalCharges = prematureCheckInFee + demurrageCharge;
  const totalChargesWithExtra = originalPrice + totalAdditionalCharges;

  return {
    totalAdditionalCharges,
    totalChargesWithExtra,
  };
}

/**
 * Get display text for charges
 */
export function formatChargesDisplay(
  prematureCheckInDays: number | null,
  extraNightsDays: number | null,
  prematureCheckInFee: number,
  demurrageCharge: number
): string {
  const parts: string[] = [];

  if (prematureCheckInDays && prematureCheckInDays > 0) {
    parts.push(
      `Early Check-in: ${prematureCheckInDays} day${prematureCheckInDays > 1 ? 's' : ''}`
    );
  }

  if (extraNightsDays && extraNightsDays > 0) {
    parts.push(
      `Extra Stay: ${extraNightsDays} day${extraNightsDays > 1 ? 's' : ''}`
    );
  }

  if (parts.length === 0) {
    return 'No additional charges';
  }

  return parts.join(' + ');
}
