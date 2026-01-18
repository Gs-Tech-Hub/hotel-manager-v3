"use client"

import { useState } from 'react'

type CreateSectionModalProps = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string, slug: string) => Promise<void>
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
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sectionName) {
      setError('Please enter a name')
      return
    }

    try {
      setError(null)
      await onSubmit(sectionName, sectionSlug)
      setSectionName('')
      setSectionSlug('')
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to create section')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-80">
        <h3 className="text-lg font-semibold mb-2">Create Section</h3>
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
        <input
          className="w-full mb-2 p-2 border rounded"
          placeholder="Name"
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          required
        />
        <input
          className="w-full mb-2 p-2 border rounded"
          placeholder="Slug (optional)"
          value={sectionSlug}
          onChange={(e) => setSectionSlug(e.target.value)}
        />
        <div className="flex gap-2 mt-2">
          <button
            type="submit"
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-blue-400"
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
          <button
            type="button"
            className="px-3 py-1 bg-gray-300 rounded"
            onClick={() => {
              onClose()
              setError(null)
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
