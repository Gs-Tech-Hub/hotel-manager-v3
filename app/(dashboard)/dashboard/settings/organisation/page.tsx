"use client"

import { Separator } from "@/components/ui/separator"
import OrganisationEditor from "@/components/admin/settings/organisation-editor"
// Ensure the file exists at the specified path, or update the import path if necessary
import ExchangeRateManager from "@/components/admin/settings/exchange-rate-manager"
import { TaxSettingsForm } from "@/components/admin/tax-settings-form"
import { CurrencyProvider } from '@/context/CurrencyClientContext'

export default function OrganisationSettingsPage() {
  return (
    <CurrencyProvider>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Organisation</h3>
          <p className="text-sm text-muted-foreground">Manage organisation information, currency, and tax settings.</p>
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

        <Separator />

        <div>
          <h3 className="text-lg font-medium">Tax Settings</h3>
          <p className="text-sm text-muted-foreground">Configure tax rates and settings for your organisation.</p>
        </div>

        <div>
          <TaxSettingsForm />
        </div>
      </div>
    </CurrencyProvider>
  )
}
