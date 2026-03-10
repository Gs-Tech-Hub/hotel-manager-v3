/**
 * Validation Schemas for Booking Forms
 */

import { z } from 'zod';

/**
 * Guest/Customer Creation Schema
 */
export const guestCreationSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name must be less than 100 characters')
    .trim(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name must be less than 100 characters')
    .trim(),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters')
    .toLowerCase()
    .trim(),
  phone: z
    .string()
    .min(1, 'Phone is required')
    .min(10, 'Phone must be at least 10 characters')
    .max(20, 'Phone must be less than 20 characters')
    .trim(),
  idNumber: z
    .string()
    .max(50, 'ID number must be less than 50 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  country: z
    .string()
    .max(100, 'Country must be less than 100 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .trim()
    .optional()
    .or(z.literal('')),
});

/**
 * Type exports for TypeScript
 */
export type GuestCreationInput = z.infer<typeof guestCreationSchema>;

/**
 * Validation helper function
 */
export function validateGuestCreation(data: unknown): { valid: boolean; data?: GuestCreationInput; errors?: Record<string, string> } {
  try {
    const validated = guestCreationSchema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { valid: false, errors };
    }
    return { valid: false, errors: { _: 'Validation failed' } };
  }
}
