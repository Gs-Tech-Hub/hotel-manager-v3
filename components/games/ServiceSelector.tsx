"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

type ServiceSelectorProps = {
  sectionId: string
  onStartGame: (data: { customerName: string; serviceId?: string }) => void
  isLoading?: boolean
}

type Service = {
  id: string
  name: string
  serviceType: string
  pricingModel: 'per_count' | 'per_time'
  pricePerCount?: number
  pricePerMinute?: number
}

export function ServiceSelector({ sectionId, onStartGame, isLoading = false }: ServiceSelectorProps) {
  const [customerName, setCustomerName] = useState('')
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<string>('')
  const [servicesLoading, setServicesLoading] = useState(false)
  const { toast } = useToast()

  // Fetch available services for this section
  useEffect(() => {
    if (!sectionId) return

    const fetchServices = async () => {
      setServicesLoading(true)
      try {
        const response = await fetch(`/api/services/by-section/${sectionId}`)
        if (!response.ok) throw new Error('Failed to fetch services')
        
        const data = await response.json()
        setServices(data.data?.services || [])
      } catch (error) {
        console.error('Failed to load services:', error)
        // Don't show error - services are optional
      } finally {
        setServicesLoading(false)
      }
    }

    fetchServices()
  }, [sectionId])

  const handleStartGame = () => {
    if (!customerName.trim()) {
      toast({ title: 'Error', description: 'Please enter customer name', variant: 'destructive' })
      return
    }

    onStartGame({
      customerName: customerName.trim(),
      serviceId: selectedService || undefined,
    })

    // Reset form
    setCustomerName('')
    setSelectedService('')
  }

  const selectedServiceData = services.find(s => s.id === selectedService)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start New Game Session</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customer Name */}
        <div>
          <label className="text-sm font-medium">Customer Name *</label>
          <Input
            placeholder="Enter customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        {/* Service Selection (Optional) */}
        {!servicesLoading && services.length > 0 && (
          <div>
            <label className="text-sm font-medium">Select Service (Optional)</label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">No service (manual pricing)</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.pricingModel === 'per_count' ? `${service.pricePerCount}/count` : `${service.pricePerMinute}/min`})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Service Info Display */}
        {selectedServiceData && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm font-semibold text-blue-900">{selectedServiceData.name}</p>
            <p className="text-xs text-blue-700">
              {selectedServiceData.pricingModel === 'per_count' 
                ? `Price: ${selectedServiceData.pricePerCount}/game` 
                : `Price: ${selectedServiceData.pricePerMinute}/minute`}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Pricing will be calculated at checkout based on game count
            </p>
          </div>
        )}

        {/* Start Game Button */}
        <Button
          onClick={handleStartGame}
          disabled={isLoading || !customerName.trim()}
          className="w-full"
        >
          {isLoading ? 'Starting...' : 'Start Game'}
        </Button>
      </CardContent>
    </Card>
  )
}
