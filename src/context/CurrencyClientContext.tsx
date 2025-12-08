"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'

type CurrencyClientContextType = {
  displayCurrency: string | null
  setDisplayCurrency: (c: string) => void
  loading: boolean
}

const CurrencyClientContext = createContext<CurrencyClientContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetch('/api/settings/organisation', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        if (json && json.currency) setDisplayCurrency(json.currency)
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <CurrencyClientContext.Provider value={{ displayCurrency, setDisplayCurrency, loading }}>
      {children}
    </CurrencyClientContext.Provider>
  )
}

export function useCurrencyClient() {
  const ctx = useContext(CurrencyClientContext)
  if (!ctx) throw new Error('useCurrencyClient must be used within CurrencyProvider')
  return ctx
}
