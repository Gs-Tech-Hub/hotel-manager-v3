import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Map department code to inventory category used by the backend filters.
 * - Bar / club -> 'drinks'
 * - Restaurant -> 'food'
 * - Default -> 'supplies'
 */
export function mapDeptCodeToCategory(code?: string | null): string | undefined {
	if (!code) return undefined
	const c = String(code).toLowerCase()
	if (c.includes('bar') || c.includes('club')) return 'drinks'
	if (c.includes('rest') || c.includes('restaurant')) return 'food'
	// Allow departments that already look like a category to pass through
	if (['drinks', 'food', 'supplies'].includes(c)) return c
	// fallback default category for other departments
	return 'supplies'
}
