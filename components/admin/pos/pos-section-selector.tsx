'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface Section {
  id: string
  name: string
  slug: string
  departmentCode: string
  departmentName: string
  today: { count: number; total: number }
}

interface POSSectionSelectorProps {
  onSectionChange: (section: Section | null) => void
  selectedSectionId?: string
  disabled?: boolean
}

export function POSSectionSelector({
  onSectionChange,
  selectedSectionId,
  disabled = false
}: POSSectionSelectorProps) {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedSection, setSelectedSection] = useState<Section | null>(null)

  useEffect(() => {
    const fetchSections = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/pos/sections')
        if (!res.ok) throw new Error('Failed to fetch sections')
        const json = await res.json()
        if (json.success && json.data) {
          setSections(json.data)
          
          // If a selectedSectionId was provided, select it
          if (selectedSectionId) {
            const found = json.data.find((s: Section) => s.id === selectedSectionId)
            if (found) {
              setSelectedSection(found)
              onSectionChange(found)
            }
          } else if (json.data.length > 0) {
            // Default to first section
            setSelectedSection(json.data[0])
            onSectionChange(json.data[0])
          }
        }
      } catch (err) {
        console.error('Failed to load sections:', err)
        setError('Failed to load sections')
      } finally {
        setLoading(false)
      }
    }

    fetchSections()
  }, [selectedSectionId, onSectionChange])

  const handleSelectSection = (section: Section) => {
    setSelectedSection(section)
    onSectionChange(section)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled || loading}
          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-left flex items-center justify-between hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex-1">
            {loading ? (
              <span className="text-gray-500 text-sm">Loading sections...</span>
            ) : selectedSection ? (
              <div>
                <div className="font-semibold text-gray-900">{selectedSection.name}</div>
                <div className="text-xs text-gray-500">{selectedSection.departmentName}</div>
              </div>
            ) : (
              <span className="text-gray-500 text-sm">Select a section</span>
            )}
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && sections.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
            <div className="max-h-48 overflow-y-auto">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSelectSection(section)}
                  className={`w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition ${
                    selectedSection?.id === section.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{section.name}</div>
                      <div className="text-xs text-gray-500">{section.departmentName}</div>
                    </div>
                    {section.today && (
                      <div className="text-right ml-2">
                        <div className="text-xs font-semibold text-gray-700">{section.today.count} tx</div>
                        <div className="text-xs text-gray-500">
                          ${(section.today.total / 100).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {sections.length === 0 && !loading && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
          No sections available
        </div>
      )}
    </div>
  )
}
