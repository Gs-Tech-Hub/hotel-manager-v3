export function normalizeToCents(v: any): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v || 0)
  if (!isFinite(n)) return 0
  // If price has fractional part, assume it's dollars and convert to cents
  if (!Number.isInteger(n)) return Math.round(n * 100)
  // If integer but small (< 1000) treat as dollars (e.g. 4 -> $4)
  if (Math.abs(n) < 1000) return Math.round(n * 100)
  // Otherwise assume already in cents
  return Math.round(n)
}

export function centsToDollars(n: any): number {
  const num = Number(n || 0)
  if (!isFinite(num)) return 0
  return num / 100
}

export function formatCents(n: any): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(centsToDollars(n))
}
