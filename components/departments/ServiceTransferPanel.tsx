"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, ArrowRight } from 'lucide-react'

type Service = {
  id: string
  name: string
  serviceType: string
  pricingModel: 'per_count' | 'per_time'
  pricePerCount?: number
  pricePerMinute?: number
  sectionId?: string | null
}

type Section = {
  id: string
  name: string
}

interface ServiceTransferPanelProps {
  departmentCode: string
  sections: Section[]
  onTransferComplete?: () => void
}

export function ServiceTransferPanel({ departmentCode, sections, onTransferComplete }: ServiceTransferPanelProps) {
  const [departmentServices, setDepartmentServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [selectedService, setSelectedService] = useState<string>('')
  const [selectedSection, setSelectedSection] = useState<string>('')
  const { toast } = useToast()

  // Load department-level services (sectionId = null)
  useEffect(() => {
    fetchDepartmentServices()
  }, [departmentCode])

  const fetchDepartmentServices = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/departments/${encodeURIComponent(departmentCode)}/services?level=department`)
      if (!response.ok) throw new Error('Failed to fetch services')
      
      const data = await response.json()
      // Only show services that don't have a section assigned (department-level)
      const deptLevelServices = (data.data?.services || []).filter((s: Service) => !s.sectionId)
      setDepartmentServices(deptLevelServices)
    } catch (error) {
      console.error('Failed to load department services:', error)
      toast({ 
        title: 'Error', 
        description: 'Failed to load services', 
        variant: 'destructive' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async () => {
    if (!selectedService || !selectedSection) {
      toast({ 
        title: 'Error', 
        description: 'Please select both a service and a destination section', 
        variant: 'destructive' 
      })
      return
    }

    setTransferring(true)
    try {
      const response = await fetch(`/api/departments/${encodeURIComponent(departmentCode)}/services/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService,
          sourceSectionId: null, // Department level
          destinationSectionId: selectedSection,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to transfer service')
      }

      toast({ 
        title: 'Success', 
        description: 'Service transferred successfully' 
      })

      // Reset selections
      setSelectedService('')
      setSelectedSection('')
      
      // Refresh services
      await fetchDepartmentServices()
      onTransferComplete?.()
    } catch (error: any) {
      console.error('Transfer error:', error)
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to transfer service', 
        variant: 'destructive' 
      })
    } finally {
      setTransferring(false)
    }
  }

  const selectedServiceData = departmentServices.find(s => s.id === selectedService)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Services to Sections</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {departmentServices.length === 0 ? (
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              No department-level services available to transfer. Create services without assigning a section first, or transfer existing section-level services.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {/* Service Selection */}
              <div>
                <label className="text-sm font-medium">Select Service to Transfer</label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full p-2 border rounded mt-1"
                  disabled={loading}
                >
                  <option value="">Choose a service...</option>
                  {departmentServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.serviceType})
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Details */}
              {selectedServiceData && (
                <div className="p-3 bg-gray-50 border rounded">
                  <p className="text-sm font-semibold text-gray-900">{selectedServiceData.name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Type: {selectedServiceData.serviceType}
                  </p>
                  <p className="text-xs text-gray-600">
                    {selectedServiceData.pricingModel === 'per_count' 
                      ? `Price: ${selectedServiceData.pricePerCount}/unit`
                      : `Price: ${selectedServiceData.pricePerMinute}/minute`}
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
                  disabled={loading || !selectedService}
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
                  disabled={!selectedService || !selectedSection || transferring || loading}
                  className="flex-1"
                >
                  {transferring ? 'Transferring...' : (
                    <>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Transfer Service
                    </>
                  )}
                </Button>
              </div>

              {/* Info */}
              <div className="text-xs text-gray-600 p-3 bg-amber-50 border border-amber-200 rounded">
                <p>💡 Once transferred, the service will be available only in the selected section and can be used when starting games in that section.</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
