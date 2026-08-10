'use client'

import { type FormEvent, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { CreateCategorySchema, UpdateCategorySchema } from '@plinto/shared'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import { useValidationMessage } from '../../../lib/api/use-validation-message'
import {
  type Category,
  type CategoryType,
  createCategory,
  updateCategory,
} from '../services/categories'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'

/** The order the type dropdown offers. Labels come from `categories.type.*`. */
const CATEGORY_TYPES: CategoryType[] = ['expense', 'income']

// Curated, well-spread hues for quick labelling. Custom colors stay possible
// via the native picker / hex field.
const PRESET_COLORS = [
  '#E8492C',
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
  const t = useTranslations('categories')
  const tCommon = useTranslations('common')
  const toErrorMessage = useErrorMessage()
  const toValidationMessage = useValidationMessage()
  const [name, setName] = useState(editing?.name ?? '')
  // Type is fixed once a category exists (it partitions income vs expense).
  const [type, setType] = useState<CategoryType>(editing?.type ?? 'expense')
  const [color, setColor] = useState(editing?.color ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; type: CategoryType; color?: string }) =>
      createCategory(payload),
    onSuccess: () => onSaved(),
  })

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; payload: { name: string; color: string | null } }) =>
      updateCategory(input.id, input.payload),
    onSuccess: () => onSaved(),
  })

  const submitting = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error ?? updateMutation.error
  const error = validationError ?? toErrorMessage(mutationError)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setValidationError(null)

    const trimmedColor = color.trim()

    if (editing) {
      const payload = { name: name.trim(), color: trimmedColor || null }
      const result = UpdateCategorySchema.safeParse(payload)
      if (!result.success) {
        setValidationError(toValidationMessage(result.error.issues[0]) ?? t('form.invalid'))
        return
      }
      updateMutation.mutate({ id: editing.id, payload })
      return
    }

    const payload = {
      name: name.trim(),
      type,
      ...(trimmedColor ? { color: trimmedColor } : {}),
    }
    const result = CreateCategorySchema.safeParse(payload)
    if (!result.success) {
      setValidationError(toValidationMessage(result.error.issues[0]) ?? t('form.invalid'))
      return
    }
    createMutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <Field label={t('form.name')} htmlFor="category-name">
          <Input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('form.namePlaceholder')}
            required
          />
        </Field>

        {!editing ? (
          <Field label={t('form.type')} htmlFor="category-type">
            <Select
              id="category-type"
              value={type}
              onChange={(event) => setType(event.target.value as CategoryType)}
            >
              {CATEGORY_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`type.${value}`)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label={t('form.color')} hint={t('form.colorHint')}>
          <div className="color-picker">
            <div className="color-swatches" role="group" aria-label={t('form.presetColors')}>
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`color-swatch-btn ${sameColor(color, preset) ? 'is-active' : ''}`.trim()}
                  style={{ background: preset }}
                  aria-label={t('form.usePreset', { color: preset })}
                  aria-pressed={sameColor(color, preset)}
                  onClick={() => setColor(preset)}
                />
              ))}
            </div>

            <div className="color-custom">
              <input
                type="color"
                className="color-native"
                aria-label={t('form.customColor')}
                value={isHexColor(color) ? color : '#E8492C'}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
              />
              <Input
                id="category-color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                placeholder="#E8492C"
                aria-label={t('form.hexColor')}
              />
              {color.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setColor('')}
                >
                  {t('form.clear')}
                </Button>
              ) : null}
            </div>
          </div>
        </Field>

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting}>
          {submitting
            ? tCommon('saving')
            : editing
              ? t('form.saveChanges')
              : t('form.createCategory')}
        </Button>
      </div>
    </form>
  )
}
