// Consolidated transfer service entrypoint under inventory services
// Re-exports the core transferService implementation so callers can import
// from '@/services/inventory/transfer.service' and keep transfer logic
// colocated with inventory functionality.

import { transferService as coreTransferService } from '@/src/services/transfer.service'

export const transferService = coreTransferService
export default transferService
