"use client"

import { useState } from 'react'

type CreateSectionModalProps = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string, slug: string, hasTerminal: boolean) => Promise<void>
  isLoading?: boolean
}

export default function CreateSectionModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateSectionModalProps) {
  const [sectionName, setSectionName] = useState('')
  const [sectionSlug, setSectionSlug] = useState('')
  const [hasTerminal, setHasTerminal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sectionName) {
      setError('Please enter a name')
      return
    }

    try {
      setError(null)
      setIsSubmitted(true)
      await onSubmit(sectionName, sectionSlug, hasTerminal)
      setSectionName('')
      setSectionSlug('')
      setHasTerminal(false)
      setIsSubmitted(false)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to create section')
      setIsSubmitted(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-96">
        <h3 className="text-lg font-semibold mb-4">Create Section</h3>
        {error && <div className="text-sm text-red-600 mb-3 p-2 bg-red-50 rounded">{error}</div>}
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Section Name</label>
            <input
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Kitchen, Bar Counter"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              disabled={isLoading || isSubmitted}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Slug (optional)</label>
            <input
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., kitchen, bar-counter"
              value={sectionSlug}
              onChange={(e) => setSectionSlug(e.target.value)}
              disabled={isLoading || isSubmitted}
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
            <input
              type="checkbox"
              id="hasTerminal"
              checked={hasTerminal}
              onChange={(e) => setHasTerminal(e.target.checked)}
              disabled={isLoading || isSubmitted}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="hasTerminal" className="text-sm font-medium cursor-pointer flex-1">
              Enable Sales Terminal for this section
            </label>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-400 disabled:cursor-not-allowed font-medium"
            disabled={isLoading || isSubmitted || !sectionName}
          >
            {isLoading || isSubmitted ? 'Creating...' : 'Create'}
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 font-medium"
            onClick={() => {
              onClose()
              setError(null)
              setSectionName('')
              setSectionSlug('')
              setHasTerminal(false)
              setIsSubmitted(false)
            }}
            disabled={isLoading || isSubmitted}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
