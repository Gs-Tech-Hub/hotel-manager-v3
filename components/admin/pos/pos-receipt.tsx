"use client"

import { useRef, useEffect, useState } from "react"
import Price from '@/components/ui/Price'

interface HotelInfo {
  name?: string
  address?: string
  email?: string
  phone?: string
  website?: string
}

export function POSReceipt({ receipt, onClose }: { receipt: any; onClose?: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [hotelInfo, setHotelInfo] = useState<HotelInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch hotel information from server
  useEffect(() => {
    let mounted = true
    setLoading(true)

    fetch('/api/settings/organisation', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (mounted) {
          setHotelInfo({
            name: data?.name || 'Hotel',
            address: data?.address,
            email: data?.email,
            phone: data?.phone,
            website: data?.website,
          })
        }
      })
      .catch((err) => {
        console.error('Failed to fetch hotel information:', err)
        if (mounted) {
          setHotelInfo({ name: 'Hotel' })
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const handlePrint = () => {
    if (!ref.current) return
    const w = window.open('', '', 'width=600,height=600')
    if (!w) return
    w.document.write('<html><body>' + ref.current.innerHTML + '</body></html>')
    w.document.close()
    w.print()
  }

  // Calculate discounts and taxes from receipt data
  const discounts = receipt?.discounts || []
  const subtotal = (receipt?.items ?? []).reduce((sum: number, it: any) => {
    return sum + (it.unitPrice * it.quantity)
  }, 0)
  const totalDiscount = discounts.reduce((sum: number, d: any) => sum + (d.discountAmount || 0), 0)
  const taxAmount = receipt?.taxAmount || 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-96 shadow-lg max-h-[90vh] overflow-auto">
        <div ref={ref} className="font-mono text-sm space-y-3">
          {/* Header: Receipt Title */}
          <div className="text-center border-b-2 border-gray-800 pb-2">
            <div className="text-lg font-bold">{hotelInfo?.name || 'Hotel'}</div>
            <div className="text-xs mt-1">PAYMENT RECEIPT</div>
          </div>

          {/* Order Info Section */}
          <div className="text-xs space-y-1 border-b border-gray-300 pb-2">
            <div className="flex justify-between">
              <span className="font-semibold">Order #:</span>
              <span>{receipt?.orderNumber ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Date:</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Time:</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex gap-2 justify-center">
            {receipt?.orderTypeDisplay === 'ITEMS ADDED' && (
              <div className="px-2 py-1 bg-green-100 border border-green-400 rounded text-xs font-bold text-green-900">
                ✓ ITEMS ADDED
              </div>
            )}
            {receipt?.orderTypeDisplay === 'EMPLOYEE CHARGE' && (
              <div className="px-2 py-1 bg-blue-100 border border-blue-400 rounded text-xs font-bold text-blue-900">
                💳 EMPLOYEE CHARGE
              </div>
            )}
            {receipt?.isDeferred && (
              <div className="px-2 py-1 bg-amber-100 border border-amber-400 rounded text-xs font-bold text-amber-900">
                ⏰ DEFERRED
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border-t-2 border-b-2 border-gray-800 py-2">
            <div className="text-xs font-bold mb-1 border-b border-gray-400 pb-1">
              <div className="grid grid-cols-12 gap-1">
                <div className="col-span-5">ITEM</div>
                <div className="col-span-2 text-center">QTY</div>
                <div className="col-span-2 text-right">PRICE</div>
                <div className="col-span-3 text-right">TOTAL</div>
              </div>
            </div>
            {(receipt?.items ?? []).map((it: any) => (
              <div key={it.lineId} className="grid grid-cols-12 gap-1 text-xs py-1 border-b border-gray-200">
                <div className="col-span-5 break-words">{it.productName}</div>
                <div className="col-span-2 text-center">{it.quantity}</div>
                <div className="col-span-2 text-right">
                  <Price amount={it.unitPrice} isMinor={true} />
                </div>
                <div className="col-span-3 text-right font-semibold">
                  <Price amount={it.unitPrice * it.quantity} isMinor={true} />
                </div>
              </div>
            ))}
          </div>

          {/* Calculations Section */}
          <div className="space-y-1 text-xs border-b border-gray-300 pb-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold"><Price amount={subtotal} isMinor={true} /></span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Tax:</span>
                <span className="font-semibold"><Price amount={taxAmount} isMinor={true} /></span>
              </div>
            )}
            {discounts.length > 0 && (
              <>
                {discounts.map((d: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-green-700">
                    <span>{d.code} {d.type === 'percentage' ? `(${d.value}%)` : ''}:</span>
                    <span className="font-semibold">-<Price amount={d.discountAmount || 0} isMinor={true} /></span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Total Section - CLEARLY SEPARATED */}
          <div className="bg-gray-100 border-2 border-gray-800 rounded p-3 my-2 text-center">
            <div className="text-xs text-gray-600 mb-1">TOTAL AMOUNT</div>
            <div className="text-3xl font-bold text-blue-600">
              <Price amount={receipt?.total ?? 0} isMinor={true} />
            </div>
          </div>

          {/* Payment Status */}
          <div className="text-xs text-center py-2 border-t border-gray-300">
            {receipt?.isDeferred ? (
              <div className="space-y-1">
                <div className="font-semibold text-amber-700">⚠️ PAYMENT PENDING</div>
                <div className="text-gray-600 text-xs">
                  To settle this order, visit the Open Orders Dashboard
                </div>
                <div className="font-semibold">Order Status: PENDING</div>
              </div>
            ) : receipt?.orderTypeDisplay === 'EMPLOYEE CHARGE' ? (
              <div className="font-semibold text-blue-600">✓ EMPLOYEE CHARGED</div>
            ) : (
              <div className="font-semibold text-green-600">✓ PAID</div>
            )}
          </div>

          {/* Employee Charge Information */}
          {receipt?.orderTypeDisplay === 'EMPLOYEE CHARGE' && (
            <div className="text-xs border-t border-gray-300 pt-2">
              <div className="font-semibold text-blue-900 mb-1">Charged to:</div>
              <div className="text-gray-700">
                {receipt?.employee?.firstname} {receipt?.employee?.lastname}
              </div>
              {receipt?.employee?.email && (
                <div className="text-gray-600 text-xs">{receipt.employee.email}</div>
              )}
              {receipt?.employeeChargeId && (
                <div className="text-gray-600 text-xs mt-1">ID: {receipt.employeeChargeId}</div>
              )}
            </div>
          )}

          {/* Organization Footer */}
          <div className="border-t-2 border-gray-800 pt-2 text-center text-xs space-y-1 text-gray-600">
            {hotelInfo?.address && <div>{hotelInfo.address}</div>}
            {hotelInfo?.phone && <div>Tel: {hotelInfo.phone}</div>}
            {hotelInfo?.email && <div>{hotelInfo.email}</div>}
            {hotelInfo?.website && <div>{hotelInfo.website}</div>}
            <div className="text-gray-500 pt-1">Generated: {new Date().toLocaleString()}</div>
            <div className="text-gray-500">Thank you for your purchase!</div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={handlePrint} className="flex-1 px-3 py-2 bg-sky-600 text-white rounded">Print</button>
          {receipt?.orderTypeDisplay === 'ITEMS ADDED' && (
            <button 
              onClick={() => window.location.href = '/pos/orders'}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded"
            >
              Back to Orders
            </button>
          )}
          <button onClick={onClose} className="flex-1 px-3 py-2 border rounded">Close</button>
        </div>
      </div>
    </div>
  )
}
