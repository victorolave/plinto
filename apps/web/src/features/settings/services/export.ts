import { apiFetchBlob } from '../../../lib/api/client'
import { saveBlob } from '../../../lib/download'

/** Downloads the whole household as the versioned JSON bundle described in docs/delivery/self-host.md. */
export async function downloadHouseholdExport(): Promise<void> {
  const { blob, filename } = await apiFetchBlob('/export/household')
  saveBlob(blob, filename ?? 'plinto-household-export.json')
}

/** Downloads the transaction ledger as CSV. */
export async function downloadTransactionsCsv(): Promise<void> {
  const { blob, filename } = await apiFetchBlob('/export/transactions.csv')
  saveBlob(blob, filename ?? 'plinto-transactions.csv')
}
