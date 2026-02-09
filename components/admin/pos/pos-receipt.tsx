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

  // Calculate discounts from receipt data
  const discounts = receipt?.discounts || []
  const subtotal = (receipt?.items ?? []).reduce((sum: number, it: any) => {
    return sum + (it.unitPrice * it.quantity)
  }, 0)
  const totalDiscount = discounts.reduce((sum: number, d: any) => sum + (d.discountAmount || 0), 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-80 shadow-lg max-h-[80vh] overflow-auto">
        <div ref={ref} className="font-mono text-sm">
          {/* Hotel Information */}
          <div className="text-center font-bold">{hotelInfo?.name || 'Hotel'}</div>
          {hotelInfo?.address && <div className="text-center text-xs">{hotelInfo.address}</div>}
          {hotelInfo?.phone && <div className="text-center text-xs">{hotelInfo.phone}</div>}
          {hotelInfo?.email && <div className="text-center text-xs">{hotelInfo.email}</div>}
          
          <div className="text-center mt-1">Receipt</div>
          
          {/* Items Added Badge */}
          {receipt?.orderTypeDisplay === 'ITEMS ADDED' && (
            <div className="mt-2 p-2 bg-green-100 border border-green-400 rounded text-center font-bold text-green-900">
              ✓ ITEMS ADDED
            </div>
          )}
          
          {/* Employee Charge Badge */}
          {receipt?.orderTypeDisplay === 'EMPLOYEE CHARGE' && (
            <div className="mt-2 p-2 bg-blue-100 border border-blue-400 rounded text-center font-bold text-blue-900">
              💳 EMPLOYEE CHARGE
            </div>
          )}
          
          {/* Deferred Order Badge */}
          {receipt?.isDeferred && (
            <div className="mt-2 p-2 bg-amber-100 border border-amber-400 rounded text-center font-bold text-amber-900">
              ⏰ DEFERRED ORDER
            </div>
          )}
          
          <div className="mt-2">Order#: {receipt?.orderNumber ?? 'N/A'}</div>
          
          {/* Status for deferred orders */}
          {receipt?.isDeferred && (
            <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
              <div className="font-semibold">Status: PENDING PAYMENT</div>
              <div className="text-gray-700 mt-1">
                This order will be settled later. Payment not yet received.
              </div>
            </div>
          )}
          
          {/* Order Items with individual prices */}
          <div className="mt-2 border-t pt-2">
            <div className="font-bold mb-1">Items:</div>
            {(receipt?.items ?? []).map((it: any) => (
              <div key={it.lineId}>
                <div className="flex justify-between text-xs">
                  <span>{it.productName}</span>
                  <span>x{it.quantity}</span>
                </div>
                <div className="flex justify-between text-xs pl-2 mb-1">
                  <span className="text-gray-600">
                    <Price amount={it.unitPrice} isMinor={true} /> each
                  </span>
                  <span className="font-semibold">
                    <Price amount={it.unitPrice * it.quantity} isMinor={true} />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Subtotal */}
          <div className="border-t mt-2 pt-2 flex justify-between text-xs">
            <span>Subtotal</span>
            <span><Price amount={subtotal} isMinor={true} /></span>
          </div>

          {/* Discounts if applied */}
          {discounts.length > 0 && (
            <div className="mt-1 bg-green-50 p-2 rounded">
              <div className="font-bold text-xs mb-1">Discounts Applied:</div>
              {discounts.map((d: any, idx: number) => (
                <div key={idx} className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700">
                    {d.code} {d.type === 'percentage' ? `(${d.value}%)` : ''}
                  </span>
                  <span className="text-green-700 font-semibold">
                    -<Price amount={d.discountAmount || 0} isMinor={true} />
                  </span>
                </div>
              ))}
              <div className="border-t border-green-200 pt-1 flex justify-between text-xs font-bold">
                <span>Total Discount</span>
                <span className="text-green-700">
                  -<Price amount={totalDiscount} isMinor={true} />
                </span>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="border-t mt-2 pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span><Price amount={receipt?.total ?? 0} isMinor={true} /></span>
          </div>
          
          {/* Employee Charge Information */}
          {receipt?.orderTypeDisplay === 'EMPLOYEE CHARGE' && (
            <div className="border-t mt-2 pt-2">
              <div className="text-xs font-semibold text-blue-900 mb-1">Charged to Employee:</div>
              <div className="text-xs text-gray-700">
                {receipt?.employee?.firstname} {receipt?.employee?.lastname}
                {receipt?.employee?.email && <div className="text-xs text-gray-600">({receipt.employee.email})</div>}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Charge ID: {receipt?.employeeChargeId}
              </div>
            </div>
          )}
          
          {/* Payment status section */}
          {receipt?.isDeferred ? (
            <div className="border-t mt-2 pt-2 text-center text-xs">
              <div className="font-semibold text-amber-700">⚠️ PAYMENT PENDING</div>
              <div className="mt-1 text-gray-600">
                To settle this order, visit the Open Orders Dashboard
              </div>
              <div className="mt-2 font-semibold">Order Status: PENDING</div>
            </div>
          ) : receipt?.orderTypeDisplay === 'EMPLOYEE CHARGE' ? (
            <div className="border-t mt-2 pt-2 flex justify-between text-xs">
              <span>Payment Status:</span>
              <span className="font-semibold text-blue-600">✓ EMPLOYEE CHARGED</span>
            </div>
          ) : (
            <div className="border-t mt-2 pt-2 flex justify-between text-xs">
              <span>Payment Status:</span>
              <span className="font-semibold text-green-600">✓ PAID</span>
            </div>
          )}
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
