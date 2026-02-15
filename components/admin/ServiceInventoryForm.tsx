"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

type ServiceInventoryFormProps = {
  departmentId?: string
  departments?: { id: string; code: string; name: string }[]
  sections?: { id: string; name: string }[]
  onServiceCreated?: (service: any) => void
}

export function ServiceInventoryForm({ departmentId, departments = [], sections = [], onServiceCreated }: ServiceInventoryFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    serviceType: 'game', // game, activity, facility, etc.
    pricingModel: 'per_count' as 'per_count' | 'per_time',
    pricePerCount: '',
    pricePerMinute: '',
    departmentId: departmentId || '',
    sectionId: '',
    description: '',
  })

  const { toast } = useToast()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.serviceType) {
      toast({ title: 'Error', description: 'Name and service type are required', variant: 'destructive' })
      return
    }

    if (!formData.departmentId) {
      toast({ title: 'Error', description: 'Please select a department', variant: 'destructive' })
      return
    }

    if (formData.pricingModel === 'per_count' && !formData.pricePerCount) {
      toast({ title: 'Error', description: 'Price per count is required', variant: 'destructive' })
      return
    }

    if (formData.pricingModel === 'per_time' && !formData.pricePerMinute) {
      toast({ title: 'Error', description: 'Price per minute is required', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/services/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          serviceType: formData.serviceType,
          pricingModel: formData.pricingModel,
          pricePerCount: formData.pricingModel === 'per_count' ? parseFloat(formData.pricePerCount) : null,
          pricePerMinute: formData.pricingModel === 'per_time' ? parseFloat(formData.pricePerMinute) : null,
          departmentId: formData.departmentId,
          sectionId: formData.sectionId || null,
          description: formData.description || null,
        })
      })

      if (!response.ok) {
        const error = await response.json()
        toast({ 
          title: 'Error', 
          description: error.error?.message || 'Failed to create service', 
          variant: 'destructive' 
        })
        return
      }

      const data = await response.json()
      toast({ title: 'Success', description: 'Service created successfully' })
      
      onServiceCreated?.(data.data.service)
      
      // Reset form
      setFormData({
        name: '',
        serviceType: 'game',
        pricingModel: 'per_count',
        pricePerCount: '',
        pricePerMinute: '',
        departmentId: departmentId || '',
        sectionId: '',
        description: '',
      })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create service', variant: 'destructive' })
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Service Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Department Selection */}
          {departments.length > 0 && (
            <div>
              <label className="text-sm font-medium">Department *</label>
              <select
                name="departmentId"
                value={formData.departmentId}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Select a department...</option>
                {departments
                  .filter((d) => !String(d.code).includes(':')) // only top-level departments
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
            </div>
          )}

          {/* Service Name */}
          <div>
            <label className="text-sm font-medium">Service Name *</label>
            <Input
              name="name"
              placeholder="e.g., Snooker Game, Swimming, Gym Pass"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          {/* Service Type */}
          <div>
            <label className="text-sm font-medium">Service Type *</label>
            <select
              name="serviceType"
              value={formData.serviceType}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            >
              <option value="game">Game</option>
              <option value="activity">Activity</option>
              <option value="facility">Facility</option>
              <option value="class">Class</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Pricing Model */}
          <div>
            <label className="text-sm font-medium">Pricing Model *</label>
            <select
              name="pricingModel"
              value={formData.pricingModel}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            >
              <option value="per_count">Per Count (games, people, items)</option>
              <option value="per_time">Per Time (hourly, per minute)</option>
            </select>
          </div>

          {/* Price Per Count */}
          {formData.pricingModel === 'per_count' && (
            <div>
              <label className="text-sm font-medium">Price Per Count *</label>
              <Input
                name="pricePerCount"
                type="number"
                step="0.01"
                placeholder="e.g., 5.00"
                value={formData.pricePerCount}
                onChange={handleChange}
                required
              />
            </div>
          )}

          {/* Price Per Minute */}
          {formData.pricingModel === 'per_time' && (
            <div>
              <label className="text-sm font-medium">Price Per Minute *</label>
              <Input
                name="pricePerMinute"
                type="number"
                step="0.01"
                placeholder="e.g., 0.50"
                value={formData.pricePerMinute}
                onChange={handleChange}
                required
              />
            </div>
          )}

          {/* Section (Optional) */}
          {sections.length > 0 && (
            <div>
              <label className="text-sm font-medium">Assign to Section (Optional)</label>
              <select
                name="sectionId"
                value={formData.sectionId}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                <option value="">Department-wide (available in all sections)</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Description (Optional)</label>
            <textarea
              name="description"
              placeholder="Description of this service..."
              value={formData.description}
              onChange={handleChange}
              className="w-full p-2 border rounded resize-none"
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creating...' : 'Create Service'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
