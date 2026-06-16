import { AccountsPanel } from '../../features/accounts/components/accounts-panel'
import { TransactionsPanel } from '../../features/transactions/components/transactions-panel'

export default function DashboardPage() {
  return (
    <>
      <AccountsPanel />
      <TransactionsPanel />
    </>
  )
}
