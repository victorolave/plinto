import { HelpCard } from '../../../features/help/components/help-card'
import { sectionMetadata } from '../../../lib/section-metadata'

export const generateMetadata = sectionMetadata('help')

export default function HelpPage() {
  return (
    <div className="page">
      <HelpCard />
    </div>
  )
}
