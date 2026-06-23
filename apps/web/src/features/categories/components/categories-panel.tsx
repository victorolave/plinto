'use client'

import { type FormEvent, useEffect, useState } from 'react'
import {
  Category,
  CategoryType,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../services/categories'

const categoryTypeOptions: Array<{ value: CategoryType; label: string }> = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
]

export function CategoriesPanel() {
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<CategoryType>('expense')
  const [color, setColor] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCategories = async () => {
    const response = await listCategories()
    setCategories(response.data.categories)
  }

  useEffect(() => {
    const run = async () => {
      try {
        await loadCategories()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load categories')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const resetForm = () => {
    setName('')
    setType('expense')
    setColor('')
    setEditingCategoryId(null)
    setError(null)
  }

  const startEditing = (category: Category) => {
    setEditingCategoryId(category.id)
    setName(category.name)
    setType(category.type)
    setColor(category.color ?? '')
    setError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const trimmedColor = color.trim()

      if (editingCategoryId) {
        await updateCategory(editingCategoryId, {
          name: name.trim(),
          color: trimmedColor || null,
        })
      } else {
        await createCategory({
          name: name.trim(),
          type,
          ...(trimmedColor ? { color: trimmedColor } : {}),
        })
      }

      resetForm()
      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (categoryId: string) => {
    setError(null)
    try {
      await deleteCategory(categoryId)
      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
    }
  }

  return (
    <section className="stack">
      <div>
        <h1>Categories</h1>
        <p className="muted">
          Organize your transactions into categories.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card stack">
        <h2>{editingCategoryId ? 'Edit category' : 'Create category'}</h2>
        <label className="label">
          Name
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        {!editingCategoryId ? (
          <label className="label">
            Type
            <select
              className="input"
              value={type}
              onChange={(event) => setType(event.target.value as CategoryType)}
            >
              {categoryTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="label">
          Color (optional)
          <input
            className="input"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            placeholder="#FF0000"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="inline-actions">
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? 'Saving...' : editingCategoryId ? 'Save changes' : 'Create category'}
          </button>
          {editingCategoryId ? (
            <button
              type="button"
              className="button secondary"
              disabled={submitting}
              onClick={resetForm}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="card stack">
        <h2>Your categories</h2>
        {loading ? <p className="muted">Loading categories...</p> : null}
        {!loading && categories.length === 0 ? (
          <p className="muted">No categories yet. Create your first category.</p>
        ) : null}
        {categories.length > 0 ? (
          <div className="stack">
            {categories.map((category) => (
              <article key={category.id} className="list-item">
                <div>
                  <strong>{category.name}</strong>
                  <p className="muted">
                    {category.type}
                    {category.color ? ` · ${category.color}` : ''}
                  </p>
                </div>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => startEditing(category)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => handleDelete(category.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
