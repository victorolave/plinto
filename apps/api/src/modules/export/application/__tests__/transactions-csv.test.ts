import { describe, expect, it } from 'vitest'
import { buildTransactionsCsv } from '../transactions-csv'
import type { TransactionCsvRow } from '../../domain/household-export.entity'

function buildRow(overrides: Partial<TransactionCsvRow> = {}): TransactionCsvRow {
  return {
    occurredAt: new Date('2026-01-15T12:00:00.000Z'),
    type: 'expense',
    amountMinor: 2_300_000,
    currency: 'COP',
    accountName: 'Cuenta principal',
    categoryName: 'Mercado',
    description: 'Compra semanal',
    source: 'manual',
    transferId: null,
    recurringRuleName: null,
    obligationName: null,
    ...overrides,
  }
}

describe('buildTransactionsCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = buildTransactionsCsv([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('writes the documented header row', () => {
    const csv = buildTransactionsCsv([])
    const firstLine = csv.slice(1).split('\r\n')[0]
    expect(firstLine).toBe(
      'occurred_at,type,amount,currency,account,category,description,source,transfer_id,recurring_rule,obligation',
    )
  })

  it('uses CRLF line endings throughout', () => {
    const csv = buildTransactionsCsv([buildRow(), buildRow()])
    expect(csv).not.toMatch(/(?<!\r)\n/)
    expect(csv.split('\r\n').length).toBeGreaterThan(2)
  })

  it('renders a zero-exponent currency (COP) with no decimals', () => {
    const csv = buildTransactionsCsv([buildRow({ amountMinor: 2_300_000, currency: 'COP' })])
    const dataLine = csv.slice(1).split('\r\n')[1]
    expect(dataLine).toContain(',2300000,COP,')
  })

  it('renders a two-exponent currency (USD) as a decimal', () => {
    const csv = buildTransactionsCsv([buildRow({ amountMinor: 123456, currency: 'USD' })])
    const dataLine = csv.slice(1).split('\r\n')[1]
    expect(dataLine).toContain(',1234.56,USD,')
  })

  it('quotes a field containing a comma', () => {
    const csv = buildTransactionsCsv([buildRow({ description: 'Arroz, frijol y carne' })])
    expect(csv).toContain('"Arroz, frijol y carne"')
  })

  it('quotes and doubles an embedded double quote', () => {
    const csv = buildTransactionsCsv([buildRow({ description: 'Dijo "gracias"' })])
    expect(csv).toContain('"Dijo ""gracias"""')
  })

  it('quotes a field containing a newline', () => {
    const csv = buildTransactionsCsv([buildRow({ description: 'Línea 1\nLínea 2' })])
    expect(csv).toContain('"Línea 1\nLínea 2"')
  })

  it('renders null category, transfer, recurring rule and obligation as empty fields', () => {
    const csv = buildTransactionsCsv([
      buildRow({
        categoryName: null,
        transferId: null,
        recurringRuleName: null,
        obligationName: null,
      }),
    ])
    const dataLine = csv.slice(1).split('\r\n')[1]
    expect(dataLine).toBe(
      '2026-01-15T12:00:00.000Z,expense,2300000,COP,Cuenta principal,,Compra semanal,manual,,,',
    )
  })

  it('joins the obligation name when a payment links the transaction', () => {
    const csv = buildTransactionsCsv([buildRow({ obligationName: 'Arriendo — enero' })])
    const dataLine = csv.slice(1).split('\r\n')[1]
    expect(dataLine.endsWith('Arriendo — enero')).toBe(true)
  })

  it('sorts rows are emitted in the order given (caller/repository owns ordering)', () => {
    const csv = buildTransactionsCsv([
      buildRow({ description: 'first' }),
      buildRow({ description: 'second' }),
    ])
    const lines = csv.slice(1).split('\r\n').filter(Boolean)
    expect(lines[1]).toContain('first')
    expect(lines[2]).toContain('second')
  })
})
