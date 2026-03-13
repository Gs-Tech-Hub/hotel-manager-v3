"use client"

import { useState } from 'react'

type IncomingTransfersModalProps = {
  isOpen: boolean
  onClose: () => void
  transfers: any[] | null
  isLoading: boolean
  onAcceptTransfer: (id: string) => Promise<void>
  onCancelTransfer?: (id: string) => Promise<void>
  onRemoveItem?: (transferId: string, itemId: string) => Promise<void>
  resolveStoreName: (transfer: any) => string
  resolveProductName: (item: any) => string
}

export default function IncomingTransfersModal({
  isOpen,
  onClose,
  transfers,
  isLoading,
  onAcceptTransfer,
  onCancelTransfer,
  onRemoveItem,
  resolveStoreName,
  resolveProductName,
}: IncomingTransfersModalProps) {
  const [accepting, setAccepting] = useState<string | null>(null)
  const [canceling, setCanceling] = useState<string | null>(null)
  const [removingItem, setRemovingItem] = useState<{ transferId: string; itemId: string } | null>(null)

  const handleAccept = async (id: string) => {
    try {
      setAccepting(id)
      await onAcceptTransfer(id)
    } finally {
      setAccepting(null)
    }
  }

  const handleCancel = async (id: string) => {
    if (!onCancelTransfer) return
    try {
      setCanceling(id)
      await onCancelTransfer(id)
    } finally {
      setCanceling(null)
    }
  }

  const handleRemoveItem = async (transferId: string, itemId: string) => {
    if (!onRemoveItem) return
    try {
      setRemovingItem({ transferId, itemId })
      await onRemoveItem(transferId, itemId)
    } finally {
      setRemovingItem(null)
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
                    <div className="text-sm mt-2 space-y-1">
                      {t.items?.map((it: any) => (
                        <div key={it.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                          <span>{resolveProductName(it)} x {it.quantity}</span>
                          {onRemoveItem && (
                            <button
                              onClick={() => handleRemoveItem(t.id, it.id)}
                              className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-red-300"
                              disabled={removingItem?.itemId === it.id}
                            >
                              {removingItem?.itemId === it.id ? 'Removing...' : '✕'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => handleAccept(t.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded disabled:bg-green-400"
                      disabled={accepting === t.id || canceling === t.id}
                    >
                      {accepting === t.id ? 'Accepting...' : 'Accept'}
                    </button>
                    {onCancelTransfer && (
                      <button
                        onClick={() => handleCancel(t.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded disabled:bg-red-400"
                        disabled={accepting === t.id || canceling === t.id}
                      >
                        {canceling === t.id ? 'Canceling...' : 'Cancel'}
                      </button>
                    )}
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
