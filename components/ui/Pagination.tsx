"use client"

import React from 'react'

type Props = {
  page: number
  total: number
  pageSize: number
  onPrev: () => void
  onNext: () => void
}

export default function Pagination({ page, total, pageSize, onPrev, onNext }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-between mt-3">
      <div>
        <button className="px-2 py-1 border rounded" onClick={onPrev} disabled={page <= 1}>Prev</button>
        <button className="px-2 py-1 border rounded ml-2" onClick={onNext} disabled={page >= pages}>Next</button>
      </div>
      <div className="text-xs">Page {page} / {pages}</div>
    </div>
  )
}
