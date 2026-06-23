'use client'

import { type FormEvent, useState } from 'react'
import { getExpenseReport } from '../services/categories'
import type { ExpenseReportItem } from '../services/categories'

export function groupReportItemsByCurrency(items: ExpenseReportItem[]): Record<string, ExpenseReportItem[]> {
  const grouped: Record<string, ExpenseReportItem[]> = {}
  for (const item of items) {
    if (!grouped[item.currency]) {
      grouped[item.currency] = []
    }
    grouped[item.currency].push(item)
  }
  return grouped
}

export function formatMinorAmount(minor: number): string {
  return (minor / 100).toFixed(2)
}

export function ExpenseReportPanel() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [items, setItems] = useState<ExpenseReportItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!from || !to) return

    setLoading(true)
    setError(null)

    try {
      const result = await getExpenseReport(from, to)
      setItems(result.data.items)
      setHasLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expense report')
    } finally {
      setLoading(false)
    }
  }

  const grouped = groupReportItemsByCurrency(items)
  const currencies = Object.keys(grouped).sort()

  return (
    <section className="stack">
      <div>
        <h1>Expense Report</h1>
        <p className="muted">
          View expenses grouped by category for a date range.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card stack">
        <h2>Filter by date range</h2>
        <label className="label">
          From
          <input
            className="input"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            required
          />
        </label>
        <label className="label">
          To
          <input
            className="input"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="button" disabled={loading || !from || !to}>
          {loading ? 'Loading...' : 'Generate report'}
        </button>
      </form>

      {hasLoaded ? (
        <div className="card stack">
          <h2>Results</h2>
          {items.length === 0 ? (
            <p className="muted">No categorized expenses found for this period.</p>
          ) : (
            currencies.map((currency) => (
              <div key={currency} className="stack">
                <h3>{currency}</h3>
                <div className="stack">
                  {grouped[currency].map((item) => (
                    <article key={`${item.categoryId}-${item.currency}`} className="list-item">
                      <div>
                        <strong>{item.categoryName}</strong>
                        <p className="muted">
                          {currency} {formatMinorAmount(item.totalMinor)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  )
}
