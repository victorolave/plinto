import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { CategoriesPanel } from '../categories-panel'
import type { Category } from '../../services/categories'

vi.mock('../../services/categories')
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { listCategories } from '../../services/categories'

const mockedListCategories = vi.mocked(listCategories)

function buildCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    tenantId: 'tenant-1',
    name: 'Groceries',
    type: 'expense',
    color: '#22C55E',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('CategoriesPanel', () => {
  it('shows a loading state before categories resolve', () => {
    mockedListCategories.mockReturnValue(new Promise(() => {}))

    renderWithProviders(<CategoriesPanel />)

    expect(screen.getByRole('status', { name: /loading categories/i })).toBeInTheDocument()
  })

  it('renders category names once the query resolves', async () => {
    mockedListCategories.mockResolvedValue({
      data: { categories: [buildCategory({ id: 'cat-1', name: 'Groceries' }), buildCategory({ id: 'cat-2', name: 'Salary', type: 'income' })] },
    })

    renderWithProviders(<CategoriesPanel />)

    expect(await screen.findByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Salary')).toBeInTheDocument()
  })

  it('shows the empty-state copy when there are no categories', async () => {
    mockedListCategories.mockResolvedValue({ data: { categories: [] } })

    renderWithProviders(<CategoriesPanel />)

    expect(await screen.findByText('No categories yet')).toBeInTheDocument()
  })
})
