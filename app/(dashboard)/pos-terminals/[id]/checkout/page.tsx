"use client"

import React from 'react'
import POSCheckoutShell from '@/components/admin/pos/pos-checkout'

export default function TerminalCheckoutPage(props: any) {
  const { params } = props;
  // `params` may be a Promise in newer Next.js versions — unwrap with React.use()
  const resolved = React.use(params as any)
  const { id } = resolved || (params as any) || {}

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Terminal Checkout — {id}</h1>
      </div>

      <POSCheckoutShell terminalId={id} />
    </div>
  )
}
