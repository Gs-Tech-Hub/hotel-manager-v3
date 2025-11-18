"use client"

import POSCheckoutShell from '@/components/admin/pos/pos-checkout'

export default function TerminalCheckoutPage(props: any) {
  const { params } = props;
  const { id } = params;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Terminal Checkout — {id}</h1>
      </div>

      <POSCheckoutShell terminalId={id} />
    </div>
  )
}
