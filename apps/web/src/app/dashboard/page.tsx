import { DashboardOverview } from '../../features/dashboard/components/dashboard-overview'
import { sectionMetadata } from '../../lib/section-metadata'

export const generateMetadata = sectionMetadata('overview')

export default function DashboardPage() {
  return <DashboardOverview />
}
