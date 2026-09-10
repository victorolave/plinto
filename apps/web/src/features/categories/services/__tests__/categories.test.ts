import { describe, expect, it, vi } from 'vitest'
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../categories'
import { apiFetch } from '../../../../lib/api/client'

vi.mock('../../../../lib/api/client', () => ({
  apiFetch: vi.fn(),
}))

describe('categories API service', () => {
  it('lists all categories from the dedicated endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { categories: [{ id: 'cat-1', name: 'Food', type: 'expense' }] } })

    const result = await listCategories()

    expect(apiFetch).toHaveBeenCalledWith('/categories')
    expect(result).toEqual({ data: { categories: [{ id: 'cat-1', name: 'Food', type: 'expense' }] } })
  })

  it('fetches a single category by id', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { category: { id: 'cat-1', name: 'Food', type: 'expense' } } })

    const result = await getCategory('cat-1')

    expect(apiFetch).toHaveBeenCalledWith('/categories/cat-1')
    expect(result).toEqual({ data: { category: { id: 'cat-1', name: 'Food', type: 'expense' } } })
  })

  it('serializes category creation with name, type, and optional color', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { category: { id: 'cat-1' } } })

    await createCategory({ name: 'Food', type: 'expense', color: '#FF0000' })

    expect(apiFetch).toHaveBeenCalledWith('/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Food', type: 'expense', color: '#FF0000' }),
    })
  })

  it('serializes category creation without color when absent', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { category: { id: 'cat-1' } } })

    await createCategory({ name: 'Salary', type: 'income' })

    expect(apiFetch).toHaveBeenCalledWith('/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Salary', type: 'income' }),
    })
  })

  it('serializes partial category update (name only)', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { category: { id: 'cat-1' } } })

    await updateCategory('cat-1', { name: 'Groceries' })

    expect(apiFetch).toHaveBeenCalledWith('/categories/cat-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Groceries' }),
    })
  })

  it('serializes category update with color null to clear it', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { category: { id: 'cat-1' } } })

    await updateCategory('cat-1', { color: null })

    expect(apiFetch).toHaveBeenCalledWith('/categories/cat-1', {
      method: 'PATCH',
      body: JSON.stringify({ color: null }),
    })
  })

  it('sends DELETE request to the category endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { deleted: true } })

    const result = await deleteCategory('cat-1')

    expect(apiFetch).toHaveBeenCalledWith('/categories/cat-1', { method: 'DELETE' })
    expect(result).toEqual({ data: { deleted: true } })
  })
})
