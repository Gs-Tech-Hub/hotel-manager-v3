"use client"

import { Separator } from "@/components/ui/separator"
import OrganisationEditor from "@/components/admin/settings/organisation-editor"
// Ensure the file exists at the specified path, or update the import path if necessary
import ExchangeRateManager from "@/components/admin/settings/exchange-rate-manager"
import { CurrencyProvider } from '@/context/CurrencyClientContext'

export default function OrganisationSettingsPage() {
  return (
    <CurrencyProvider>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Organisation</h3>
          <p className="text-sm text-muted-foreground">Manage organisation information and currency settings.</p>
        </div>
        <Separator />

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <OrganisationEditor />
          </div>
          <div>
            <ExchangeRateManager />
          </div>
        </div>
      </div>
    </CurrencyProvider>
  )
}
