import { toMajorUnitsString } from '@plinto/shared'
import type { TransactionCsvRow } from '../domain/household-export.entity'

const HEADER = [
  'occurred_at',
  'type',
  'amount',
  'currency',
  'account',
  'category',
  'description',
  'source',
  'transfer_id',
  'recurring_rule',
  'obligation',
]

/**
 * Quotes one CSV field per RFC 4180: wrapped in double quotes whenever it
 * contains a comma, a double quote, or a line break, with embedded quotes
 * doubled. Everything else — including an empty string for a null field —
 * passes through unquoted, since that is what most spreadsheet software
 * expects for a plain value.
 */
function csvField(value: string): string {
  const neutralised = neutraliseFormula(value)
  if (/[",\n\r]/.test(neutralised)) {
    return `"${neutralised.replace(/"/g, '""')}"`
  }
  return neutralised
}

/**
 * Defuses CSV injection. Spreadsheets treat a cell starting with `=`, `+`,
 * `-`, `@`, a tab or a carriage return as a formula, so a transaction
 * described as `=cmd|'/c calc'!A0` would execute on open. A leading
 * apostrophe makes the cell literal text. Plain numbers are left alone so a
 * negative amount still parses as a number.
 */
function neutraliseFormula(value: string): string {
  if (/^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value)) {
    return `'${value}`
  }
  return value
}

function csvRow(fields: string[]): string {
  return fields.map(csvField).join(',')
}

/**
 * Renders the transaction ledger as RFC 4180 CSV, UTF-8 with a leading BOM
 * (so Excel — which otherwise guesses Latin-1 for a BOM-less UTF-8 file —
 * opens accented household names correctly) and CRLF line endings (the RFC's
 * own line terminator, and what every spreadsheet importer expects without a
 * "detect encoding" prompt).
 *
 * `amount` is rendered in MAJOR units using each row's own currency
 * exponent — `2300000` stays `2300000` for a COP row (exponent 0) and
 * `123456` becomes `1234.56` for a 2-exponent currency — because a CSV is
 * read by a human in a spreadsheet, not by code that already knows to divide.
 */
export function buildTransactionsCsv(rows: TransactionCsvRow[]): string {
  const lines = [csvRow(HEADER)]

  for (const row of rows) {
    lines.push(
      csvRow([
        row.occurredAt.toISOString(),
        row.type,
        toMajorUnitsString(row.amountMinor, row.currency),
        row.currency,
        row.accountName,
        row.categoryName ?? '',
        row.description ?? '',
        row.source,
        row.transferId ?? '',
        row.recurringRuleName ?? '',
        row.obligationName ?? '',
      ]),
    )
  }

  const BOM = '\uFEFF'
  return BOM + lines.join('\r\n') + '\r\n'
}
