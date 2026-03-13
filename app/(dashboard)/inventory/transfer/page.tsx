"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import TransferPanel from '@/components/transfer/TransferPanel'
import { useRouter } from 'next/navigation'

export default function InventoryTransferPage() {
  const router = useRouter()
  const [source, setSource] = useState<string | null>(null)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const sourceParam = params.get('source')
      setSource(sourceParam)
    } catch (e) {
      // window might be undefined during some rendering lifecycles; ignore
    }
  }, [])

  if (!source) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Create Transfer</h1>
          <button onClick={() => router.back()} className="px-3 py-1 border rounded">Back</button>
        </div>
        <div className="text-sm text-red-600">
          No source department selected. Go back to <Link href="/inventory" className="text-sky-600">Inventory</Link> and pick a source department.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Create Transfer</h1>
          <div className="text-sm text-muted-foreground">Source: <span className="font-mono">{source}</span></div>
        </div>
        <button onClick={() => router.back()} className="px-3 py-1 border rounded">Back</button>
      </div>

      <TransferPanel 
        sourceCode={source}
        onClose={() => {
          // After successful transfer, navigate back to inventory
          router.push(`/inventory?department=${encodeURIComponent(source)}`)
        }}
      />
    </div>
  )
}
