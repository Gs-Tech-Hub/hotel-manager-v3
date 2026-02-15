"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

type Service = {
  id: string
  name: string
  serviceType: string
  pricingModel: 'per_count' | 'per_time'
  pricePerCount?: number
  pricePerMinute?: number
  description?: string
  section?: { id: string; name: string }
  department?: { id: string; code: string; name: string }
}

type ServiceListProps = {
  departmentId: string
  onDeleteSuccess?: () => void
}

export function ServiceList({ departmentId, onDeleteSuccess }: ServiceListProps) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchServices()
  }, [departmentId])

  const fetchServices = async () => {
    setLoading(true)
    try {
      // Fetch all services (this would need a dedicated endpoint)
      const response = await fetch(`/api/services?departmentId=${departmentId}`)
      if (response.ok) {
        const data = await response.json()
        setServices(data.data?.services || [])
      } else {
        toast({ 
          title: 'Info', 
          description: 'Services endpoint not yet implemented. Use form to create services.'
        })
      }
    } catch (error) {
      console.error('Failed to fetch services:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return

    setDeleting(serviceId)
    try {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error?.message || 'Failed to delete service',
          variant: 'destructive',
        })
        return
      }

      toast({ title: 'Success', description: 'Service deleted successfully' })
      setServices(services.filter(s => s.id !== serviceId))
      onDeleteSuccess?.()
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete service', variant: 'destructive' })
      console.error(error)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-500">Loading services...</p>
        </CardContent>
      </Card>
    )
  }

  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-500">No services created yet. Use the form above to create one.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Services ({services.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {services.map(service => (
            <div
              key={service.id}
              className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">{service.name}</h4>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {service.serviceType}
                  </span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    {service.pricingModel === 'per_count' ? 'Per Count' : 'Per Time'}
                  </span>
                </div>

                <div className="mt-2 text-sm text-gray-600 space-y-1">
                  {service.description && (
                    <p>{service.description}</p>
                  )}
                  <p>
                    Price:{' '}
                    <span className="font-semibold text-gray-900">
                      {service.pricingModel === 'per_count'
                        ? `${service.pricePerCount}/count`
                        : `${service.pricePerMinute}/minute`}
                    </span>
                  </p>
                  {service.section && (
                    <p className="text-xs text-gray-500">
                      Section: <span className="font-medium">{service.section.name}</span>
                    </p>
                  )}
                  {!service.section && service.department && (
                    <p className="text-xs text-gray-500">
                      Department-wide (available in all sections)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={deleting === service.id}
                  onClick={() => handleDelete(service.id)}
                >
                  {deleting === service.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
