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
  departmentId?: string | null
}

type Department = {
  id: string
  name: string
  code: string
}

interface GlobalServiceTransferPanelProps {
  onTransferComplete?: () => void
  targetDepartment?: Department // If specified, only show transfer to this department
}

/**
 * Global Service Transfer Component
 * Allows transferring services between departments and sections
 * Supports:
 * - Transferring from any source (global, department, section) to any destination
 * - Auto-discovery of source location if not specified
 * - Direct transfers between departments
 */
export function GlobalServiceTransferPanel({ onTransferComplete, targetDepartment }: GlobalServiceTransferPanelProps) {
  const [services, setServices] = useState<Service[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [selectedService, setSelectedService] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>(targetDepartment?.id || '')
  const { toast } = useToast()

  // Load available services and departments
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [servicesRes, deptsRes] = await Promise.all([
        fetch('/api/services/list'),
        fetch('/api/departments')
      ])

      if (servicesRes.ok) {
        const data = await servicesRes.json()
        setServices(data.data?.services || [])
      }

      if (deptsRes.ok) {
        const data = await deptsRes.json()
        setDepartments(data.data?.departments || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast({ 
        title: 'Error', 
        description: 'Failed to load services or departments', 
        variant: 'destructive' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async () => {
    if (!selectedService || !selectedDepartment) {
      toast({ 
        title: 'Error', 
        description: 'Please select both a service and a destination department', 
        variant: 'destructive' 
      })
      return
    }

    setTransferring(true)
    try {
      const response = await fetch('/api/services/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService,
          toDepartmentId: selectedDepartment,
          toSectionId: null // Transfer to department level
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to transfer service')
      }

      const result = await response.json()
      
      toast({ 
        title: 'Success', 
        description: `Service transferred: ${result.data?.transfer?.from} → ${result.data?.transfer?.to}` 
      })

      // Reset selection
      setSelectedService('')
      
      // Refresh data
      await loadData()
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

  // Filter departments if target is specified
  const availableDepartments = targetDepartment 
    ? departments.filter(d => d.id === targetDepartment.id)
    : departments

  const selectedServiceData = services.find(s => s.id === selectedService)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Services Between Departments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {services.length === 0 ? (
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              No services available. Create services first via the service management interface.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {/* Service Selection */}
              <div>
                <label className="text-sm font-medium">Select Service</label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full p-2 border rounded mt-1"
                  disabled={loading}
                >
                  <option value="">Choose a service...</option>
                  {services.map((service) => (
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

              {/* Department Selection */}
              {!targetDepartment && (
                <div>
                  <label className="text-sm font-medium">Destination Department</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full p-2 border rounded mt-1"
                    disabled={loading || !selectedService}
                  >
                    <option value="">Choose a department...</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Transfer Button */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleTransfer}
                  disabled={!selectedService || !selectedDepartment || transferring || loading}
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
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
