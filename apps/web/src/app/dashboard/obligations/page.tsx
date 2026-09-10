import { ObligationsPanel } from '../../../features/obligations/components/obligations-panel'
import { sectionMetadata } from '../../../lib/section-metadata'

export const generateMetadata = sectionMetadata('obligations')

export default function ObligationsPage() {
  return <ObligationsPanel />
}
