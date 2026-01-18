"use client"

import { useState } from 'react'

type UpdateStatsButtonProps = {
  code: string
  onUpdate: () => Promise<void>
}

export default function UpdateStatsButton({ code, onUpdate }: UpdateStatsButtonProps) {
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!code) return
    setBusy(true)
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(code)}/update-stats`, {
        method: 'POST',
      })

      const j = await res.json()
      if (!res.ok || !j?.success) {
        alert(j?.error?.message || 'Update failed')
        return
      }
      // Refresh local data
      try {
        await onUpdate()
      } catch (e) {
        console.warn('refresh after update failed', e)
      }
      alert('Department stats updated')
    } catch (e: any) {
      console.error('Update stats error', e)
      alert(e?.message || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={run} className="px-3 py-1 border rounded text-sm disabled:opacity-50" disabled={busy}>
      {busy ? 'Updating…' : 'Update Stats'}
    </button>
  )
}
