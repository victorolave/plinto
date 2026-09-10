import { TransactionsPanel } from '../../../features/transactions/components/transactions-panel'
import { sectionMetadata } from '../../../lib/section-metadata'

export const generateMetadata = sectionMetadata('transactions')

export default function TransactionsPage() {
  return <TransactionsPanel />
}
