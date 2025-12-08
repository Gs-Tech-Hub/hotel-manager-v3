"use client"

import React, { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CURRENCY_CATALOG, getCurrencySymbol } from "@/lib/currency"

interface RatesResponse {
  base: string
  rates: Record<string, number>
}

export default function ExchangeRateManager() {
  const [base, setBase] = useState<string>("USD")
  const [rates, setRates] = useState<Record<string, number>>({})
  const [from, setFrom] = useState<string>("USD")
  const [to, setTo] = useState<string>("NGN")
  const [rateValue, setRateValue] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/settings/exchange-rates?base=${base}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json: RatesResponse) => setRates(json.rates || {}))
      .catch((e) => console.error(e))
  }, [base])

  async function setRate() {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/exchange-rates", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, rate: Number(rateValue) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed")
      toast.success("Exchange rate saved")
      // refresh
      const resp = await fetch(`/api/settings/exchange-rates?base=${base}`, { credentials: "include" })
      const j = await resp.json()
      setRates(j.rates || {})
    } catch (e) {
      console.error(e)
      toast.error("Failed to save rate")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Exchange Rates (base: {base} {getCurrencySymbol(base)})</Label>
        <div className="mt-2">
          {Object.entries(rates).length === 0 ? (
            <p className="text-sm text-muted-foreground">No rates set for this base.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {Object.entries(rates).map(([k, v]) => (
                <li key={k}>{getCurrencySymbol(k)} {k}: {v.toFixed(4)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Input 
            value={from} 
            placeholder="USD"
            onChange={(e) => setFrom(e.target.value.toUpperCase())} 
          />
          <p className="text-xs text-muted-foreground mt-1">{from && CURRENCY_CATALOG[from as any]?.symbol ? `${CURRENCY_CATALOG[from as any]?.symbol} - ${CURRENCY_CATALOG[from as any]?.name}` : 'From'}</p>
        </div>
        <div>
          <Input 
            value={to} 
            placeholder="NGN"
            onChange={(e) => setTo(e.target.value.toUpperCase())} 
          />
          <p className="text-xs text-muted-foreground mt-1">{to && CURRENCY_CATALOG[to as any]?.symbol ? `${CURRENCY_CATALOG[to as any]?.symbol} - ${CURRENCY_CATALOG[to as any]?.name}` : 'To'}</p>
        </div>
        <Input 
          type="number" 
          value={rateValue} 
          placeholder="Rate"
          onChange={(e) => setRateValue(Number(e.target.value))} 
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={setRate} disabled={saving}>{saving ? 'Saving…' : 'Set Rate'}</Button>
        <Button variant="secondary" onClick={() => { setBase(from); }}>Use From as Base</Button>
      </div>
    </div>
  )
}
