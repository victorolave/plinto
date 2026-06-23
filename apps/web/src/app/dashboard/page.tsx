import { AccountsPanel } from '../../features/accounts/components/accounts-panel'
import { TransactionsPanel } from '../../features/transactions/components/transactions-panel'
import { CategoriesPanel } from '../../features/categories/components/categories-panel'
import { ExpenseReportPanel } from '../../features/categories/components/expense-report-panel'

export default function DashboardPage() {
  return (
    <>
      <AccountsPanel />
      <TransactionsPanel />
      <CategoriesPanel />
      <ExpenseReportPanel />
    </>
  )
}
