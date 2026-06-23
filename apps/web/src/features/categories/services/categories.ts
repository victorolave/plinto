import { apiFetch } from '../../../lib/api/client'

export type CategoryType = 'income' | 'expense'

export interface Category {
  id: string
  tenantId: string
  name: string
  type: CategoryType
  color: string | null
  createdAt: string
  updatedAt: string
}

export interface ExpenseReportItem {
  categoryId: string
  categoryName: string
  currency: string
  totalMinor: number
}

export interface ExpenseReport {
  from: string
  to: string
  items: ExpenseReportItem[]
}

export async function listCategories(): Promise<{ data: { categories: Category[] } }> {
  return apiFetch('/categories')
}

export async function getCategory(id: string): Promise<{ data: { category: Category } }> {
  return apiFetch(`/categories/${encodeURIComponent(id)}`)
}

export async function createCategory(input: {
  name: string
  type: CategoryType
  color?: string
}): Promise<{ data: { category: Category } }> {
  return apiFetch('/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateCategory(
  id: string,
  input: {
    name?: string
    color?: string | null
  },
): Promise<{ data: { category: Category } }> {
  return apiFetch(`/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteCategory(id: string): Promise<{ data: { deleted: boolean } }> {
  return apiFetch(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function getExpenseReport(
  from: string,
  to: string,
): Promise<{ data: ExpenseReport }> {
  return apiFetch(`/reports/expenses-by-category?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
}
