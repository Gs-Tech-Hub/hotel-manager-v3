"use client"

import React, { useEffect, useState } from 'react'
import { useCurrencyClient } from '@/context/CurrencyClientContext'

interface PriceProps {
  /** amount in minor units (e.g., cents) */
  amount: number
  /** currency code of the amount provided; if omitted, assumes organisation/display currency */
  currency?: string
  /** whether to auto-convert to organisation/display currency */
  autoConvert?: boolean
  /** show original amount next to converted value */
  showOriginal?: boolean
  /** if true, `amount` is in minor units; if false, `amount` is major units (e.g., 12.34) */
  isMinor?: boolean
}

export default function Price({ amount, currency, autoConvert = true, showOriginal = false, isMinor = true }: PriceProps) {
  const { displayCurrency, loading } = useCurrencyClient()
  const [converted, setConverted] = useState<number | null>(null)
  const [formatted, setFormatted] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function doConvert() {
      const sourceCurrency = currency || displayCurrency || 'USD'
      if (!autoConvert || !displayCurrency || displayCurrency === sourceCurrency) {
        setConverted(null)
        setFormatted(null)
        return
      }

      try {
        // If amount is provided as major units, convert to minor units (assume 2 decimals)
        const minorAmount = isMinor ? amount : Math.round(amount * 100)

        const res = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: minorAmount, from: sourceCurrency, to: displayCurrency }),
          credentials: 'include',
        })
        const json = await res.json()
        if (!mounted) return
        if (json?.minorUnits !== undefined) {
          setConverted(json.minorUnits)
          setFormatted(json.formatted)
        }
      } catch (e) {
        // ignore
      }
    }

    if (!loading) doConvert()

    return () => {
      mounted = false
    }
  }, [amount, currency, displayCurrency, loading, autoConvert, isMinor])

  // If converted exists, show that; otherwise show formatted original using Intl
  if (formatted) {
    return (
      <span>
        {formatted}
        {showOriginal ? (
          <small className="ml-2 text-muted-foreground">({(amount / 100).toFixed(2)} {currency})</small>
        ) : null}
      </span>
    )
  }

  // Fallback formatting for original amount (assume 100 minorUnits)
  const sourceCurrency = currency || displayCurrency || 'USD'
  const major = (amount / 100).toFixed(2)
  return (
    <span>
      {major} {sourceCurrency}
    </span>
  )
}
