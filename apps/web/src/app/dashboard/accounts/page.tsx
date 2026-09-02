import { AccountsPanel } from '../../../features/accounts/components/accounts-panel'
import { sectionMetadata } from '../../../lib/section-metadata'

export const generateMetadata = sectionMetadata('accounts')

export default function AccountsPage() {
  return <AccountsPanel />
}
