"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

interface Section {
  id: string
  name: string
  slug: string | null
  isActive: boolean
  departmentId: string
  hasTerminal: boolean
}

interface Terminal {
  id: string
  name: string
  slug: string
  description: string | null
  type: 'consolidated' | 'section'
  isActive: boolean
  allowedSectionIds: string[]
  sections: Section[]
}

interface TerminalSectionManagerProps {
  terminalId: string
}

export function TerminalSectionManager({ terminalId }: TerminalSectionManagerProps) {
  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [availableSections, setAvailableSections] = useState<Section[]>([])
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load terminal and available sections
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/terminals/${terminalId}/sections/update`)
        if (res.ok) {
          const data = await res.json()
          setTerminal(data.data.terminal)
          setAvailableSections(data.data.availableSections)
          setSelectedSectionIds(new Set(data.data.terminal.allowedSectionIds))
        } else {
          toast.error('Failed to load terminal')
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load terminal sections')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [terminalId])

  const handleToggleSection = (sectionId: string) => {
    const newSelected = new Set(selectedSectionIds)
    if (newSelected.has(sectionId)) {
      newSelected.delete(sectionId)
    } else {
      newSelected.add(sectionId)
    }
    setSelectedSectionIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedSectionIds.size === availableSections.length) {
      setSelectedSectionIds(new Set())
    } else {
      setSelectedSectionIds(new Set(availableSections.map(s => s.id)))
    }
  }

  const handleSave = async () => {
    if (!terminal) return

    try {
      setSaving(true)
      const res = await fetch(`/api/terminals/${terminalId}/sections/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowedSectionIds: Array.from(selectedSectionIds),
        }),
      })

      if (res.ok) {
        toast.success('Terminal sections updated successfully')
        setTerminal({
          ...terminal,
          allowedSectionIds: Array.from(selectedSectionIds),
        })
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to update terminal')
      }
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-600">Loading terminal...</p>
        </CardContent>
      </Card>
    )
  }

  if (!terminal) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-red-600">Terminal not found</p>
        </CardContent>
      </Card>
    )
  }

  // Group sections by department
  const sectionsByDept: { [deptId: string]: Section[] } = {}
  availableSections.forEach(section => {
    if (!sectionsByDept[section.departmentId]) {
      sectionsByDept[section.departmentId] = []
    }
    sectionsByDept[section.departmentId].push(section)
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{terminal.name}</CardTitle>
          <p className="text-sm text-gray-600 mt-2">{terminal.description}</p>
          <p className="text-xs text-gray-500 mt-1">Type: {terminal.type}</p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Allowed Sections</CardTitle>
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-600">
              Selected: {selectedSectionIds.size} / {availableSections.length}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedSectionIds.size === availableSections.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(sectionsByDept).map(([deptId, deptSections]) => (
              <div key={deptId}>
                <h4 className="font-semibold text-sm mb-2 text-gray-700">
                  {deptSections[0]?.departmentId}
                </h4>
                <div className="space-y-2 ml-4">
                  {deptSections.map(section => (
                    <div
                      key={section.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50"
                    >
                      <Checkbox
                        id={section.id}
                        checked={selectedSectionIds.has(section.id)}
                        onCheckedChange={() => handleToggleSection(section.id)}
                        disabled={!section.isActive}
                      />
                      <label
                        htmlFor={section.id}
                        className="flex-1 cursor-pointer flex items-center gap-2"
                      >
                        <span className={section.isActive ? '' : 'text-gray-400 line-through'}>
                          {section.name}
                        </span>
                        {!section.isActive && (
                          <span className="text-xs text-gray-500">(Inactive)</span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
