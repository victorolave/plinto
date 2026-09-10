import { DebtsPanel } from '../../../features/debts/components/debts-panel'
import { sectionMetadata } from '../../../lib/section-metadata'

export const generateMetadata = sectionMetadata('debts')

export default function DebtsPage() {
  return <DebtsPanel />
}
