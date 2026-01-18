"use client"

import { useState } from 'react'

type IncomingTransfersModalProps = {
  isOpen: boolean
  onClose: () => void
  transfers: any[] | null
  isLoading: boolean
  onAcceptTransfer: (id: string) => Promise<void>
  resolveStoreName: (transfer: any) => string
  resolveProductName: (item: any) => string
}

export default function IncomingTransfersModal({
  isOpen,
  onClose,
  transfers,
  isLoading,
  onAcceptTransfer,
  resolveStoreName,
  resolveProductName,
}: IncomingTransfersModalProps) {
  const [accepting, setAccepting] = useState<string | null>(null)

  const handleAccept = async (id: string) => {
    try {
      setAccepting(id)
      await onAcceptTransfer(id)
    } finally {
      setAccepting(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-md w-full md:w-3/4 max-h-[80vh] overflow-auto p-4 z-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Incoming Transfers</h3>
          <button onClick={onClose} className="px-2 py-1 border rounded">
            Close
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm">Loading...</div>
        ) : (
          <div className="space-y-3">
            {transfers && transfers.length > 0 ? (
              transfers.map((t: any) => (
                <div key={t.id} className="p-3 border rounded flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">From: {resolveStoreName(t)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()}
                    </div>
                    <div className="text-sm mt-2">
                      {t.items?.map((it: any) => (
                        <div key={it.id}>
                          {resolveProductName(it)} x {it.quantity}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => handleAccept(t.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded disabled:bg-green-400"
                      disabled={accepting === t.id}
                    >
                      {accepting === t.id ? 'Accepting...' : 'Accept'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No incoming transfers.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
