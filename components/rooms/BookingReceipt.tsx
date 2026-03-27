"use client"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import Price from '@/components/ui/Price'

interface ReservationData {
  id: string
  confirmationNo: string
  unit?: { roomNumber: string | null }
  guest?: { firstName: string; lastName: string; email: string; phone: string }
  checkInDate: string
  checkOutDate: string
  totalPriceCents: number
  status: string
  createdAt: string
}

interface HotelInfo {
  name?: string
  address?: string
  email?: string
  phone?: string
  website?: string
}

export function BookingReceipt({ reservation, onClose }: { reservation: ReservationData; onClose?: () => void }) {
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

  const handleDownloadPDF = async () => {
    try {
      // Simple PDF download via print to file (browser native)
      const printWindow = window.open('', '', 'width=600,height=600')
      if (!printWindow || !ref.current) return
      
      printWindow.document.write('<html><head><title>Booking Receipt</title></head><body>')
      printWindow.document.write(ref.current.innerHTML)
      printWindow.document.write('</body></html>')
      printWindow.document.close()
      
      // Show save dialog
      setTimeout(() => {
        printWindow.print()
      }, 250)
    } catch (error) {
      console.error('Failed to download PDF:', error)
    }
  }

  const checkInDate = new Date(reservation.checkInDate).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const checkOutDate = new Date(reservation.checkOutDate).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const totalPrice = (reservation.totalPriceCents / 100).toFixed(2)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-96 shadow-lg max-h-[90vh] overflow-auto">
        <div ref={ref} className="font-mono text-sm space-y-3">
          {/* Header: Receipt Title */}
          <div className="text-center border-b-2 border-gray-800 pb-2">
            <div className="text-lg font-bold">{hotelInfo?.name || 'Hotel Manager'}</div>
            <div className="text-xs mt-1">BOOKING RECEIPT</div>
          </div>

          {/* Confirmation Number - Center Prominence */}
          <div className="text-center bg-blue-50 border border-blue-200 rounded p-2">
            <div className="text-xs text-gray-700">Confirmation #</div>
            <div className="text-lg font-bold font-sans text-blue-600">{reservation.confirmationNo}</div>
          </div>

          {/* Status Badge */}
          <div className="text-center">
            <span className={`inline-block px-3 py-1 rounded text-xs font-bold ${
              reservation.status === 'CONFIRMED' ? 'bg-green-100 text-green-900' :
              reservation.status === 'CHECKED_IN' ? 'bg-blue-100 text-blue-900' :
              reservation.status === 'COMPLETED' ? 'bg-gray-100 text-gray-900' :
              'bg-yellow-100 text-yellow-900'
            }`}>
              {reservation.status}
            </span>
          </div>

          {/* Guest Information Section */}
          <div className="space-y-1 text-xs border-t border-b border-gray-300 py-2">
            <div className="font-bold text-gray-800 mb-1">GUEST INFORMATION</div>
            <div className="flex justify-between">
              <span className="font-semibold">Name:</span>
              <span>{reservation.guest?.firstName} {reservation.guest?.lastName}</span>
            </div>
            {reservation.guest?.email && (
              <div className="flex justify-between">
                <span className="font-semibold">Email:</span>
                <span className="text-right">{reservation.guest.email}</span>
              </div>
            )}
            {reservation.guest?.phone && (
              <div className="flex justify-between">
                <span className="font-semibold">Phone:</span>
                <span>{reservation.guest.phone}</span>
              </div>
            )}
          </div>

          {/* Booking Details Section */}
          <div className="space-y-1 text-xs border-b border-gray-300 pb-2">
            <div className="font-bold text-gray-800 mb-1">BOOKING DETAILS</div>
            <div className="flex justify-between">
              <span className="font-semibold">Room:</span>
              <span>{reservation.unit?.roomNumber || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Check-in:</span>
              <span>{checkInDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Check-out:</span>
              <span>{checkOutDate}</span>
            </div>
          </div>

          {/* Total Amount - CLEARLY SEPARATED */}
          <div className="bg-gray-100 border-2 border-gray-800 rounded p-3 my-2 text-center">
            <div className="text-xs text-gray-600 mb-1">TOTAL AMOUNT DUE</div>
            <div className="text-3xl font-bold text-blue-600">${totalPrice}</div>
          </div>

          {/* Organization Footer */}
          <div className="border-t-2 border-gray-800 pt-2 text-center text-xs space-y-1 text-gray-600">
            {hotelInfo?.address && <div>{hotelInfo.address}</div>}
            {hotelInfo?.phone && <div>Tel: {hotelInfo.phone}</div>}
            {hotelInfo?.email && <div>{hotelInfo.email}</div>}
            {hotelInfo?.website && <div>{hotelInfo.website}</div>}
            <div className="text-gray-500 pt-1">Generated: {new Date().toLocaleString()}</div>
            <div className="text-gray-500">Thank you for your booking!</div>
            <div className="text-gray-500">Please keep this receipt for your records</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="flex-1"
            disabled={loading}
          >
            Print
          </Button>
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            className="flex-1"
            disabled={loading}
          >
            Download
          </Button>
          <Button
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
