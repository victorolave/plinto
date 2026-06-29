'use client'

import { type CSSProperties, type FormEvent, useEffect, useState } from 'react'
import {
  Category,
  CategoryType,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../services/categories'
import { Card, CardHeader } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { Badge } from '../../../components/ui/badge'
import { Pencil, Trash } from '../../../components/ui/icons'

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
    <div className="page">
      <div
        className="panel-grid"
        style={
          {
            '--panel-cols': 'minmax(0, 1fr) minmax(0, 1.4fr)',
            gap: 'var(--space-5)',
          } as CSSProperties
        }
      >
        <Card>
          <CardHeader title={editingCategoryId ? 'Edit category' : 'Create category'} />
          <form onSubmit={handleSubmit} className="stack">
            <Field label="Name" htmlFor="category-name">
              <Input
                id="category-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Groceries"
                required
              />
            </Field>

            {!editingCategoryId ? (
              <Field label="Type" htmlFor="category-type">
                <Select
                  id="category-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as CategoryType)}
                >
                  {categoryTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label="Color" hint="Optional — used as a marker on this category." htmlFor="category-color">
              <Input
                id="category-color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                placeholder="#FD5447"
              />
            </Field>

            {error ? <p className="error-text">{error}</p> : null}

            <div className="inline-actions">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : editingCategoryId ? 'Save changes' : 'Create category'}
              </Button>
              {editingCategoryId ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card flush>
          <div style={{ padding: 'var(--space-6) var(--space-6) 0' }}>
            <CardHeader title="Your categories" subtitle="Used to label income and expenses" />
          </div>
          <div style={{ padding: '0 var(--space-6) var(--space-4)' }}>
            {loading ? <p className="muted">Loading categories…</p> : null}
            {!loading && categories.length === 0 ? (
              <p className="muted">No categories yet. Create your first category.</p>
            ) : null}
            {categories.map((category) => (
              <div key={category.id} className="data-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 'var(--radius-xs)',
                      background: category.color || 'var(--neutral-300)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div className="account-name">{category.name}</div>
                  </div>
                  <Badge tone={category.type === 'income' ? 'success' : 'neutral'}>
                    {category.type}
                  </Badge>
                </div>
                <div className="inline-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Pencil size={15} />}
                    onClick={() => startEditing(category)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<Trash size={15} />}
                    onClick={() => handleDelete(category.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
