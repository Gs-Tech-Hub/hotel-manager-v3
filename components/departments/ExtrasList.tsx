"use client"

import React, { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Trash2, Edit2 } from 'lucide-react'
import Price from '@/components/ui/Price'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Extra = {
  id: string
  name: string
  unit: string
  price: number
  sectionId?: string | null
  section?: { id: string; name: string }
  departmentExtras?: Array<{
    id: string
    quantity: number
    reserved: number
    sectionId?: string | null
  }>
}

interface ExtrasListProps {
  departmentCode: string
  extras: Extra[]
  loading?: boolean
  onDelete?: (extraId: string) => void
  onEdit?: (extra: Extra) => void
  onTransfer?: () => void
}

export function ExtrasList({ departmentCode, extras, loading, onDelete, onEdit, onTransfer }: ExtrasListProps) {
  const [deleteExtra, setDeleteExtra] = useState<Extra | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const handleDelete = async (extra: Extra) => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/departments/${encodeURIComponent(departmentCode)}/extras/${extra.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to delete extra')
      }

      toast({
        title: 'Success',
        description: `${extra.name} has been deleted`,
      })

      setDeleteExtra(null)
      onDelete?.(extra.id)
    } catch (error: any) {
      console.error('Delete error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete extra',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  if (!extras || extras.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed rounded">
        <p className="text-gray-500">No extras created yet</p>
        <p className="text-sm text-gray-400 mt-1">Create extras using the form above</p>
      </div>
    )
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {extras.map((extra) => {
              const quantity = extra.departmentExtras?.[0]?.quantity || 0

              return (
                <TableRow key={extra.id}>
                  <TableCell className="font-medium">{extra.name}</TableCell>
                  <TableCell>{extra.unit}</TableCell>
                  <TableCell>
                    <Price amount={extra.price} isMinor={true} />
                  </TableCell>
                  <TableCell>{quantity}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {extra.section?.name || extra.sectionId ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {extra.section?.name || 'Section'}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        Department
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit?.(extra)}
                        disabled={loading}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteExtra(extra)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteExtra} onOpenChange={() => !deleting && setDeleteExtra(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Extra</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteExtra?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={() => !deleting && setDeleteExtra(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => deleteExtra && handleDelete(deleteExtra)}
              disabled={deleting}
              variant="destructive"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

