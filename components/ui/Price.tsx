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

  const sourceCurrency = currency || displayCurrency
  const majorNumber = isMinor ? Number(amount || 0) / 100 : Number(amount || 0)

  useEffect(() => {
    let mounted = true
    async function doConvert() {
      const sourceCurrency = currency || displayCurrency
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
    // showOriginal: display the original amount formatted with Intl (uses currency symbol)
    if (showOriginal) {
      if (sourceCurrency) {
        try {
          const orig = new Intl.NumberFormat(undefined, { style: 'currency', currency: sourceCurrency }).format(majorNumber)
          return (
            <span>
              {formatted}
              <small className="ml-2 text-muted-foreground">({orig})</small>
            </span>
          )
        } catch (e) {
          return (
            <span>
              {formatted}
              <small className="ml-2 text-muted-foreground">({(isMinor ? (amount / 100).toFixed(2) : Number(amount).toFixed(2))} {sourceCurrency})</small>
            </span>
          )
        }
      }
      // no known source currency — show plain number as original
      return (
        <span>
          {formatted}
          <small className="ml-2 text-muted-foreground">({majorNumber.toFixed(2)})</small>
        </span>
      )
    }
    return <span>{formatted}</span>
  }

  // Fallback formatting for original amount — respect `isMinor` flag and prefer currency symbol
  if (sourceCurrency) {
    try {
      const formattedOriginal = new Intl.NumberFormat(undefined, { 
        style: 'currency', 
        currency: sourceCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(majorNumber)
      return (
        <span>
          {formattedOriginal}
        </span>
      )
    } catch (e) {
      // Fallback to numeric + currency code
      const major = majorNumber.toFixed(2)
      return (
        <span>
          {major} {sourceCurrency}
        </span>
      )
    }
  }

  // No currency available — show plain number
  return <span>{majorNumber.toFixed(2)}</span>
}
