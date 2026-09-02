import { CreditPanel } from '../../../features/credit/components/credit-panel'
import { sectionMetadata } from '../../../lib/section-metadata'

export const generateMetadata = sectionMetadata('credit')

export default function CreditPage() {
  return <CreditPanel />
}
