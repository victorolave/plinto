'use client'

import { type FormEvent, useState } from 'react'
import { CreateCategorySchema, UpdateCategorySchema } from '@plinto/shared'
import {
  type Category,
  type CategoryType,
  createCategory,
  updateCategory,
} from '../services/categories'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'

const categoryTypeOptions: Array<{ value: CategoryType; label: string }> = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
]

// Curated, well-spread hues for quick labelling. Custom colors stay possible
// via the native picker / hex field.
const PRESET_COLORS = [
  '#FD5447',
  '#F59E0B',
  '#EAB308',
  '#22C55E',
  '#14B8A6',
  '#3B82F6',
  '#6366F1',
  '#A855F7',
  '#EC4899',
  '#6B7280',
]

const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value.trim())
const sameColor = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

export interface CategoryFormProps {
  /** When set, edits this category; otherwise creates a new one. */
  editing: Category | null
  onSaved: () => void | Promise<void>
}

export function CategoryForm({ editing, onSaved }: CategoryFormProps) {
  const [name, setName] = useState(editing?.name ?? '')
  // Type is fixed once a category exists (it partitions income vs expense).
  const [type, setType] = useState<CategoryType>(editing?.type ?? 'expense')
  const [color, setColor] = useState(editing?.color ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const trimmedColor = color.trim()

    if (editing) {
      const payload = {
        name: name.trim(),
        color: trimmedColor || null,
      }
      const result = UpdateCategorySchema.safeParse(payload)
      if (!result.success) {
        setError(result.error.issues[0]?.message ?? 'Invalid category')
        return
      }

      setSubmitting(true)
      setError(null)
      try {
        await updateCategory(editing.id, payload)
        await onSaved()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save category')
      } finally {
        setSubmitting(false)
      }
      return
    }

    const payload = {
      name: name.trim(),
      type,
      ...(trimmedColor ? { color: trimmedColor } : {}),
    }
    const result = CreateCategorySchema.safeParse(payload)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid category')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await createCategory(payload)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <Field label="Name" htmlFor="category-name">
          <Input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Groceries"
            required
          />
        </Field>

        {!editing ? (
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

        <Field
          label="Color"
          hint="Optional — a marker shown next to this category."
        >
          <div className="color-picker">
            <div className="color-swatches" role="group" aria-label="Preset colors">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`color-swatch-btn ${sameColor(color, preset) ? 'is-active' : ''}`.trim()}
                  style={{ background: preset }}
                  aria-label={`Use ${preset}`}
                  aria-pressed={sameColor(color, preset)}
                  onClick={() => setColor(preset)}
                />
              ))}
            </div>

            <div className="color-custom">
              <input
                type="color"
                className="color-native"
                aria-label="Custom color"
                value={isHexColor(color) ? color : '#FD5447'}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
              />
              <Input
                id="category-color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                placeholder="#FD5447"
                aria-label="Hex color"
              />
              {color.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setColor('')}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </Field>

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting}>
          {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </form>
  )
}
