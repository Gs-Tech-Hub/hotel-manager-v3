"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, ArrowRight, Trash2 } from 'lucide-react'
import Price from '@/components/ui/Price'

type Extra = {
  id: string
  name: string
  unit: string
  price: number
  sectionId?: string | null
  section?: { id: string; name: string }
  departmentExtras?: Array<{ quantity: number; reserved: number; sectionId?: string | null }>
}

type Section = {
  id: string
  name: string
}

interface ExtraTransferPanelProps {
  departmentCode: string
  sections: Section[]
  onTransferComplete?: () => void
}

export function ExtraTransferPanel({ departmentCode, sections, onTransferComplete }: ExtraTransferPanelProps) {
  const [departmentExtras, setDepartmentExtras] = useState<Extra[]>([])
  const [loading, setLoading] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [selectedExtra, setSelectedExtra] = useState<string>('')
  const [selectedSection, setSelectedSection] = useState<string>('')
  const { toast } = useToast()

  // Load department-level extras (sectionId = null)
  useEffect(() => {
    fetchDepartmentExtras()
  }, [departmentCode])

  const fetchDepartmentExtras = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/departments/${encodeURIComponent(departmentCode)}/extras?level=department`)
      if (!response.ok) throw new Error('Failed to fetch extras')
      
      const data = await response.json()
      // Only show extras that don't have a section assigned (department-level)
      const deptLevelExtras = (data.data?.extras || []).filter((e: Extra) => !e.sectionId)
      setDepartmentExtras(deptLevelExtras)
    } catch (error) {
      console.error('Failed to load department extras:', error)
      toast({ 
        title: 'Error', 
        description: 'Failed to load extras', 
        variant: 'destructive' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async () => {
    if (!selectedExtra || !selectedSection) {
      toast({ 
        title: 'Error', 
        description: 'Please select both an extra and a destination section', 
        variant: 'destructive' 
      })
      return
    }

    setTransferring(true)
    try {
      const response = await fetch(`/api/departments/${encodeURIComponent(departmentCode)}/extras/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraId: selectedExtra,
          sourceSectionId: null, // Department level
          destinationSectionId: selectedSection,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to transfer extra')
      }

      toast({ 
        title: 'Success', 
        description: 'Extra transferred successfully' 
      })

      // Reset selections
      setSelectedExtra('')
      setSelectedSection('')
      
      // Refresh extras
      await fetchDepartmentExtras()
      onTransferComplete?.()
    } catch (error: any) {
      console.error('Transfer error:', error)
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to transfer extra', 
        variant: 'destructive' 
      })
    } finally {
      setTransferring(false)
    }
  }

  const selectedExtraData = departmentExtras.find(e => e.id === selectedExtra)
  const quantity = selectedExtraData?.departmentExtras?.[0]?.quantity || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Extras to Sections</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {departmentExtras.length === 0 ? (
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              No department-level extras available to transfer. Create extras without assigning a section first.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {/* Extra Selection */}
              <div>
                <label className="text-sm font-medium">Select Extra to Transfer</label>
                <select
                  value={selectedExtra}
                  onChange={(e) => setSelectedExtra(e.target.value)}
                  className="w-full p-2 border rounded mt-1"
                  disabled={loading}
                >
                  <option value="">Choose an extra...</option>
                  {departmentExtras.map((extra) => (
                    <option key={extra.id} value={extra.id}>
                      {extra.name} ({extra.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Extra Details */}
              {selectedExtraData && (
                <div className="p-3 bg-gray-50 border rounded">
                  <p className="text-sm font-semibold text-gray-900">{selectedExtraData.name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Unit: {selectedExtraData.unit}
                  </p>
                  <p className="text-xs text-gray-600">
                    Price: <Price amount={selectedExtraData.price} isMinor={true} />
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Available: {quantity}
                  </p>
                </div>
              )}

              {/* Section Selection */}
              <div>
                <label className="text-sm font-medium">Select Destination Section</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full p-2 border rounded mt-1"
                  disabled={loading || !selectedExtra}
                >
                  <option value="">Choose a section...</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer Button */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleTransfer}
                  disabled={!selectedExtra || !selectedSection || transferring || loading}
                  className="flex-1"
                >
                  {transferring ? 'Transferring...' : (
                    <>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Transfer Extra
                    </>
                  )}
                </Button>
              </div>

              {/* Info */}
              <div className="text-xs text-gray-600 p-3 bg-amber-50 border border-amber-200 rounded">
                <p>💡 Once transferred, the extra will be available only in the selected section.</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
