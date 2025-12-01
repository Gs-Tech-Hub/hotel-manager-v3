"use client"

import React, { useEffect, useState } from "react"
import { CURRENCY_CATALOG } from "@/lib/currency"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

type CurrencyCode = string

export default function CurrencySelector() {
  const [current, setCurrent] = useState<CurrencyCode | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Fetch current organisation currency
    fetch("/api/admin/settings/currency", { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (json?.currency) setCurrent(json.currency)
      })
      .catch((err) => {
        console.error("Failed to load organisation currency", err)
      })
  }, [])

  async function onChange(code: CurrencyCode) {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/currency", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: code }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      setCurrent(code)
      toast.success("Organisation currency updated")
    } catch (e) {
      console.error(e)
      toast.error("Failed to update currency")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label>Organisation Currency</Label>
          <p className="text-sm text-muted-foreground">Select the base currency the organisation uses for prices.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Select value={current || ""} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(CURRENCY_CATALOG).map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} — {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={() => current && onChange(current)} disabled={saving}>
          Save
        </Button>
      </div>
    </div>
  )
}
