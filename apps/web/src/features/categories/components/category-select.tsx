'use client'

import type { Category, CategoryType } from '../services/categories'

export function filterCategoriesByType(categories: Category[], type: CategoryType): Category[] {
  return categories.filter((c) => c.type === type)
}

interface CategorySelectProps {
  type: CategoryType
  value: string | null
  onChange: (value: string | null) => void
  categories: Category[]
}

export function CategorySelect({ type, value, onChange, categories }: CategorySelectProps) {
  const filtered = filterCategoriesByType(categories, type)

  return (
    <select
      className="input"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">No category</option>
      {filtered.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
          {category.color ? ` (${category.color})` : ''}
        </option>
      ))}
    </select>
  )
}
