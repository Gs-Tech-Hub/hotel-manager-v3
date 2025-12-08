"use client"

import React, { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { CURRENCY_CATALOG } from "@/lib/currency"

interface OrgPayload {
  id?: string
  name?: string
  address?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  logoDark?: string | null
  logoLight?: string | null
  currency?: string | null
}

export default function OrganisationEditor() {
  const [org, setOrg] = useState<OrgPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings/organisation", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setOrg(data))
      .catch((e) => console.error("Failed to load org info", e))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/organisation", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(org || {}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed")
      setOrg(json)
      toast.success("Organisation info saved")
    } catch (e) {
      console.error(e)
      toast.error("Failed to save organisation info")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Loading...</p>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Organisation Name</Label>
          <Input value={org?.name || ""} onChange={(e) => setOrg({ ...(org || {}), name: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={org?.email || ""} onChange={(e) => setOrg({ ...(org || {}), email: e.target.value })} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={org?.phone || ""} onChange={(e) => setOrg({ ...(org || {}), phone: e.target.value })} />
        </div>
        <div>
          <Label>Website</Label>
          <Input value={org?.website || ""} onChange={(e) => setOrg({ ...(org || {}), website: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Address</Label>
          <Input value={org?.address || ""} onChange={(e) => setOrg({ ...(org || {}), address: e.target.value })} />
        </div>
        <div>
          <Label>Base Currency</Label>
          <select
            className="w-full px-3 py-2 border rounded"
            value={org?.currency || "USD"}
            onChange={(e) => setOrg({ ...(org || {}), currency: e.target.value })}
          >
            {Object.values(CURRENCY_CATALOG).map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Organisation Info"}
        </Button>
        <Separator orientation="vertical" />
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  )
}
