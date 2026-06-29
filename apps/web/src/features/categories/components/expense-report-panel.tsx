'use client'

import { type FormEvent, useState } from 'react'
import { getExpenseReport } from '../services/categories'
import type { ExpenseReportItem } from '../services/categories'
import { Card, CardHeader } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Field, Input } from '../../../components/ui/field'
import { Amount, CurrencyTag } from '../../../components/ui/amount'
import { Calendar } from '../../../components/ui/icons'

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
    <div className="page">
      <Card>
        <CardHeader
          title="Expenses by category"
          subtitle="Totals are kept separate per currency — never mixed."
        />
        <form onSubmit={handleSubmit}>
          <div
            className="cluster"
            style={{ alignItems: 'flex-end', gap: 'var(--space-4)' }}
          >
            <Field label="From" htmlFor="report-from" className="">
              <Input
                id="report-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                required
              />
            </Field>
            <Field label="To" htmlFor="report-to">
              <Input
                id="report-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
              />
            </Field>
            <Button
              type="submit"
              leftIcon={<Calendar size={16} />}
              disabled={loading || !from || !to}
            >
              {loading ? 'Loading…' : 'Generate report'}
            </Button>
          </div>
          {error ? (
            <p className="error-text" style={{ marginTop: 'var(--space-3)' }}>
              {error}
            </p>
          ) : null}
        </form>
      </Card>

      {hasLoaded ? (
        items.length === 0 ? (
          <Card>
            <p className="muted">No categorized expenses found for this period.</p>
          </Card>
        ) : (
          currencies.map((currency) => {
            const total = grouped[currency].reduce((sum, item) => sum + item.totalMinor, 0)
            return (
              <section key={currency}>
                <div className="section-head">
                  <CurrencyTag currency={currency} />
                  <h2 className="card-title">Expenses</h2>
                  <div className="section-total">
                    <span className="plinto-eyebrow">Total in {currency}</span>
                    <Amount minor={total} currency={currency} size="lg" />
                  </div>
                </div>
                <Card flush>
                  <div style={{ padding: '0 var(--space-6)' }}>
                    {grouped[currency].map((item) => (
                      <div key={`${item.categoryId}-${item.currency}`} className="data-row">
                        <span className="account-name">{item.categoryName}</span>
                        <Amount minor={item.totalMinor} currency={item.currency} size="sm" />
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            )
          })
        )
      ) : null}
    </div>
  )
}
