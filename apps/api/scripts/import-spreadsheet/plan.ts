/**
 * Turns the extracted workbook into the exact set of rows to write.
 *
 * Pure on purpose: it touches no database, so the dry run and the real load are
 * guaranteed to be the same plan rather than two code paths that agree today.
 * Every id is minted here, which is what lets the manifest record precisely what
 * was created before anything is written.
 */
import { randomUUID } from 'node:crypto'

export const TENANT_ID = 'fbeacd27-f9ca-4ac6-b2a7-9ea2f0108009'
export const CURRENCY = 'COP'
/** Real history only. Sep–Dec 2026 on the sheet is copied projection. */
export const FROM = { year: 2025, month: 1 }
export const TO = { year: 2026, month: 8 }

export type ExtractItem = {
  ref: string
  concept: string
  amount: number | null
  formula: string | null
}

export type ExtractBlock = {
  year: number
  month: number
  sheet: string
  header: string
  items: ExtractItem[]
  sheetTotal: number | null
  sheetMissing: number | null
  paidLeaves: { ref: string; value: number }[]
  loanTable: {
    aggregateRef: string
    aggregateAmount: number | null
    anchor: string | null
    labelledMonth: number | null
    rows: { lender: string; totalToPay: number | null; principal: number | null; ref: string }[]
    resolved: boolean
  } | null
}

export type ExtractIncome = {
  sheet: string
  year: number
  month: number
  day: number
  income: number | null
  loan: number | null
  counterparty: string | null
  ref: string
  isInternalTransfer: boolean
  isThirdParty: boolean
}

export type Extract = {
  expenseYears: Record<string, ExtractBlock[]>
  income: ExtractIncome[]
}

// --------------------------------------------------------------------------
// Naming
// --------------------------------------------------------------------------

export const ACCOUNTS = {
  bancolombia: { name: 'Bancolombia', type: 'bank' },
  nequi: { name: 'Nequi', type: 'bank' },
  nu: { name: 'Nu', type: 'credit' },
  sandra: { name: 'Cuenta Sandra', type: 'bank' },
  /**
   * Every expense payment is drawn from here. The spreadsheet never recorded
   * which account paid what, so any attribution would be invented; parking it
   * in one account keeps that fiction visible and leaves Bancolombia, Nequi and
   * Cuenta Sandra interpretable against the income that really landed in them.
   */
  cash: { name: 'Caja hogar (histórico)', type: 'cash' },
} as const

/**
 * One account per lender brand, not per lender-and-person. The sheet writes
 * "RAPICREDIT VIC" and "RAPICREDIT SAN" for the same lender; who borrowed stays
 * in the obligation's name, where it is a label, instead of splitting the
 * liability into two accounts that would each hold half a relationship.
 */
const LENDER_BRANDS: [RegExp, string][] = [
  [/^LINERU/, 'Lineru'],
  [/^(RAPICREDIT|RAPPI\s*CREDIC)/, 'Rapicredit'],
  [/^PRESTA\s+EN\s+L[IÍ]NEA/, 'Presta en Línea'],
  [/^WASTICREDI[CT]/, 'Wasticredit'],
  [/^SOLVENTA/, 'Solventa'],
  [/^SU\s*(\+|MAS)\s*PAY/, 'Su+Pay'],
  [/^YA\s+DINERO/, 'Ya Dinero'],
  [/^ANTICIPO/, 'Anticipo'],
  [/^(DR\.?|DOCTOR)\s*PESO/, 'Dr. Peso'],
  [/^DO[ÑN]A\s+ALBA/, 'Doña Alba'],
  [/^DR\.?\s*OSCAR/, 'Dr. Oscar Enciso'],
  [/^KATHE\s+VIDAL/, 'Kathe Vidal'],
]

export function lenderBrand(raw: string): string {
  const upper = raw.toUpperCase().trim()
  for (const [pattern, brand] of LENDER_BRANDS) if (pattern.test(upper)) return brand
  return raw.trim()
}

/** Money lands in the borrower's own account; the sheet marks that with SAN/VIC. */
function lenderDestination(raw: string): 'sandra' | 'bancolombia' {
  return /\b(SAN|SANDRA)\b/.test(raw.toUpperCase()) ? 'sandra' : 'bancolombia'
}

/**
 * Concepts the household owes every single month. Only these become recurring
 * rules; everything else is a one-off obligation, because a rule whose amount
 * changes every month is a rule in name only.
 */
const RECURRING: [RegExp, string][] = [
  [/^ARRIENDO$/, 'Arriendo'],
  [/^SERVICIOS PUBLICOS$/, 'Servicios públicos'],
  [/^SEGURIDAD /, 'Seguridad social'],
  [/^CLARO HOGAR$/, 'Claro Hogar'],
  [/^ASEO$/, 'Aseo'],
  [/^GIMNASIO$/, 'Gimnasio'],
  [/^ENTRENADOR VICTOR$/, 'Entrenador'],
  [/^PLAN SANDRA$/, 'Plan Sandra'],
  [/^PLAN VICTOR$/, 'Plan Victor'],
  [/^PLAN MAM[ÁA]$/, 'Plan Mamá'],
  [/^SUSCRIPCIONES$/, 'Suscripciones'],
]

export function recurringName(concept: string): string | null {
  const upper = concept.toUpperCase().trim()
  for (const [pattern, name] of RECURRING) if (pattern.test(upper)) return name
  return null
}

export const CATEGORIES = [
  { key: 'vivienda', name: 'Vivienda', type: 'expense' },
  { key: 'servicios', name: 'Servicios', type: 'expense' },
  { key: 'deuda', name: 'Deuda', type: 'expense' },
  { key: 'suscripciones', name: 'Suscripciones', type: 'expense' },
  { key: 'salud', name: 'Salud y bienestar', type: 'expense' },
  { key: 'salario', name: 'Salario', type: 'income' },
  { key: 'honorarios', name: 'Honorarios', type: 'income' },
] as const

/** Only where the concept says it outright. Anything else stays uncategorised. */
export function categoryFor(concept: string): string | null {
  const u = concept.toUpperCase()
  if (/^ARRIENDO/.test(u)) return 'vivienda'
  if (/SERVICIOS PUBLICOS|CLARO HOGAR|^PLAN /.test(u)) return 'servicios'
  if (/^SUSCRIPCIONES/.test(u)) return 'suscripciones'
  if (/GIMNASIO|ENTRENADOR|ORTODONCIA|SEGURIDAD/.test(u)) return 'salud'
  if (/TARJETA|CREDITO|CREDIMARCAS|SISTECREDITO|ADDI|SU \+ PAY|AGAVAL|TUYA|SOMOS|FLAMINGO|JAMAR|CUOTA/.test(u))
    return 'deuda'
  return null
}

function incomeCategory(counterparty: string | null): string | null {
  if (!counterparty) return null
  const u = counterparty.toUpperCase()
  if (/LEAN TECH|DEV\.? SENIOR|SALARIO/.test(u)) return 'salario'
  if (/HONORARIOS|ASESOR[IÍ]A/.test(u)) return 'honorarios'
  return null
}

// --------------------------------------------------------------------------
// Plan
// --------------------------------------------------------------------------

/**
 * Months where the plan deliberately disagrees with the sheet, because the
 * sheet is wrong. Listed rather than forced through, so that a NEW disagreement
 * still stops the load.
 */
export const KNOWN_SHEET_DEFECTS: Record<string, { delta: number; why: string }> = {
  '2025-09': {
    delta: -100_000,
    why: 'Su TOTAL es SUM(I70:I95)+C102, y C102 es el arriendo de OCTUBRE (2.300.000) ' +
      'en vez del de septiembre (2.200.000). Las líneas del mes suman 19.810.860; ' +
      'la hoja declara 19.910.860. Se carga la suma real.',
  },
}

export type Row = Record<string, unknown>

export type Plan = {
  accounts: Row[]
  categories: Row[]
  rules: Row[]
  obligations: Row[]
  transfers: Row[]
  transactions: Row[]
  payments: Row[]
  notes: string[]
  stats: Record<string, number>
  perPeriod: Map<string, {
    expected: number
    paid: number
    sheetTotal: number | null
    sheetMissing: number | null
  }>
}

const pad = (n: number) => String(n).padStart(2, '0')
const period = (y: number, m: number) => `${y}-${pad(m)}`
const dayUTC = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

function inRange(y: number, m: number): boolean {
  const v = y * 12 + m
  return v >= FROM.year * 12 + FROM.month && v <= TO.year * 12 + TO.month
}

export function buildPlan(data: Extract): Plan {
  const notes: string[] = []
  const stats: Record<string, number> = {}
  const bump = (k: string, n = 1) => { stats[k] = (stats[k] ?? 0) + n }

  // --- accounts -----------------------------------------------------------
  const accountId = new Map<string, string>()
  const accounts: Row[] = []
  const addAccount = (key: string, name: string, type: string) => {
    const id = randomUUID()
    accountId.set(key, id)
    accounts.push({ id, tenantId: TENANT_ID, name, type, currency: CURRENCY })
    return id
  }
  for (const [key, a] of Object.entries(ACCOUNTS)) addAccount(key, a.name, a.type)

  // --- categories ---------------------------------------------------------
  const categoryId = new Map<string, string>()
  const categories: Row[] = CATEGORIES.map((c) => {
    const id = randomUUID()
    categoryId.set(c.key, id)
    return { id, tenantId: TENANT_ID, name: c.name, type: c.type }
  })

  const blocks = Object.values(data.expenseYears)
    .flat()
    .filter((b) => inRange(b.year, b.month))
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))

  // --- recurring rules ----------------------------------------------------
  // The rule's own amount is the one the household pays most often; the real
  // figure for each month rides on the obligation, which is what the sheet
  // actually records.
  const seen = new Map<string, number[]>()
  for (const b of blocks)
    for (const it of b.items) {
      const name = recurringName(it.concept)
      if (name && it.amount) (seen.get(name) ?? seen.set(name, []).get(name)!).push(it.amount)
    }
  const ruleId = new Map<string, string>()
  const rules: Row[] = [...seen.entries()].map(([name, amounts]) => {
    const counts = new Map<number, number>()
    for (const a of amounts) counts.set(a, (counts.get(a) ?? 0) + 1)
    const mode = [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0]
    const id = randomUUID()
    ruleId.set(name, id)
    return {
      id, tenantId: TENANT_ID, accountId: accountId.get('cash')!, name,
      type: 'expense', amountMinor: Math.round(mode), currency: CURRENCY,
      frequency: 'monthly', dayOfMonth: 1,
      startDate: dayUTC(FROM.year, FROM.month, 1), status: 'active',
    }
  })

  // --- online-loan tables: resolve collisions -----------------------------
  // Two blocks pointing at one sub-table means the sheet copied a reference
  // (May 2026 took June's). The month the table is titled for keeps the detail;
  // the other stays a single aggregate line rather than gaining invented rows.
  const claims = new Map<string, ExtractBlock[]>()
  for (const b of blocks) {
    // Qualified by sheet: cell K180 exists on both year sheets and holds a
    // different table on each.
    const anchor = b.loanTable?.anchor ? `${b.sheet}!${b.loanTable.anchor}` : null
    if (anchor) (claims.get(anchor) ?? claims.set(anchor, []).get(anchor)!).push(b)
  }
  const explodes = new Set<ExtractBlock>()
  for (const [anchor, contenders] of claims) {
    let winner = contenders[0]
    if (contenders.length > 1) {
      winner =
        contenders.find((b) => b.month === b.loanTable!.labelledMonth) ??
        contenders[contenders.length - 1]
      const losers = contenders.filter((b) => b !== winner)
        .map((b) => period(b.year, b.month)).join(', ')
      notes.push(
        `Colisión en ${anchor}: ${contenders.map((b) => period(b.year, b.month)).join(' y ')} ` +
        `apuntan a la misma sub-tabla. Se explota ${period(winner.year, winner.month)}; ` +
        `${losers} queda como línea agregada (la hoja copió la referencia).`,
      )
    }
    explodes.add(winner)
  }

  // --- obligations, payments, loan transfers ------------------------------
  const obligations: Row[] = []
  const transactions: Row[] = []
  const payments: Row[] = []
  const transfers: Row[] = []
  const perPeriod: Plan['perPeriod'] = new Map()

  const payFor = (obligationId: string, name: string, amount: number, when: Date, category: string | null) => {
    const txId = randomUUID()
    transactions.push({
      id: txId, tenantId: TENANT_ID, accountId: accountId.get('cash')!,
      type: 'expense', amountMinor: amount, currency: CURRENCY,
      description: name, occurredAt: when, source: 'manual',
      categoryId: category ? categoryId.get(category) ?? null : null,
    })
    payments.push({
      id: randomUUID(), tenantId: TENANT_ID,
      obligationInstanceId: obligationId, transactionId: txId,
    })
  }

  for (const block of blocks) {
    const p = period(block.year, block.month)
    const due = dayUTC(block.year, block.month, 1)
    // A month the household closed out. Where it did not, the TOTAL PAGADOS
    // formula names the very cells that were settled.
    const closed = block.sheetMissing === 0
    const paidRefs = new Set(block.paidLeaves.map((l) => l.ref))
    // A leaf outside this block is the sheet standing in one cell for another —
    // every month's TOTAL PAGADOS reaches for the NEXT month's rent cell rather
    // than its own. Matched back by amount so the payment is not lost.
    const strays: number[] = block.paidLeaves
      .filter((l) => !block.items.some((i) => i.ref === l.ref))
      .map((l) => Math.round(l.value))
    const claimStray = (amount: number) => {
      const at = strays.indexOf(amount)
      if (at === -1) return false
      strays.splice(at, 1)
      return true
    }
    const usedRules = new Set<string>()
    let expected = 0
    let paidSum = 0

    for (const item of block.items) {
      if (item.amount === null || item.amount <= 0) {
        if (item.amount === 0) bump('lineas.montoCero')
        continue
      }
      const isAggregateLoans = block.loanTable?.aggregateRef === item.ref
      const wasPaid = closed || paidRefs.has(item.ref) || claimStray(Math.round(item.amount))

      if (isAggregateLoans && explodes.has(block)) {
        // Layer B: the aggregate line is replaced by the loans behind it. Each
        // loan carries its own settlement, so a month that paid only some of
        // them says so instead of collapsing to "the block was paid".
        for (const row of block.loanTable!.rows) {
          if (!row.totalToPay || row.totalToPay <= 0) continue
          const rowPaid = wasPaid || paidRefs.has(row.ref)
          const brand = lenderBrand(row.lender)
          const key = `debt:${brand}`
          if (!accountId.has(key)) addAccount(key, brand, 'debt')

          const obId = randomUUID()
          obligations.push({
            id: obId, tenantId: TENANT_ID, sourceType: 'manual',
            period: p, dueDate: due, name: row.lender,
            expectedAmountMinor: Math.round(row.totalToPay), currency: CURRENCY,
          })
          expected += Math.round(row.totalToPay)
          bump('obligaciones.prestamoOnline')
          if (rowPaid) {
            payFor(obId, row.lender, Math.round(row.totalToPay), due, 'deuda')
            paidSum += Math.round(row.totalToPay)
            bump('pagos.prestamoOnline')
          }

          // The disbursement: money arrives from the lender's liability account,
          // which is why it never shows up as income.
          if (row.principal && row.principal > 0) {
            const dest = accountId.get(lenderDestination(row.lender))!
            const transferId = randomUUID()
            const amount = Math.round(row.principal)
            transfers.push({
              id: transferId, tenantId: TENANT_ID,
              sourceAccountId: accountId.get(key)!, destinationAccountId: dest,
              sourceAmountMinor: amount, destinationAmountMinor: amount,
              sourceCurrency: CURRENCY, destinationCurrency: CURRENCY,
            })
            for (const [acct, type] of [[accountId.get(key)!, 'expense'], [dest, 'income']] as const)
              transactions.push({
                id: randomUUID(), tenantId: TENANT_ID, accountId: acct, type,
                amountMinor: amount, currency: CURRENCY,
                description: `Préstamo ${row.lender}`, occurredAt: due,
                transferId, source: 'manual', categoryId: null,
              })
            bump('transferencias.desembolso')
          }
        }
        continue
      }

      const ruleName = recurringName(item.concept)
      const useRule = ruleName !== null && !usedRules.has(ruleName)
      if (ruleName && usedRules.has(ruleName))
        notes.push(`${p}: "${item.concept}" repite la regla ${ruleName}; va como obligación puntual.`)
      if (useRule) usedRules.add(ruleName!)

      const obId = randomUUID()
      const amount = Math.round(item.amount)
      obligations.push({
        id: obId, tenantId: TENANT_ID,
        sourceType: useRule ? 'recurring_rule' : 'manual',
        recurringRuleId: useRule ? ruleId.get(ruleName!)! : null,
        period: p, dueDate: due, name: item.concept,
        expectedAmountMinor: amount, currency: CURRENCY,
      })
      expected += amount
      bump(useRule ? 'obligaciones.regla' : 'obligaciones.puntual')
      if (wasPaid) {
        payFor(obId, item.concept, amount, due, categoryFor(item.concept))
        paidSum += amount
        bump('pagos.gasto')
      }
    }

    perPeriod.set(p, {
      expected, paid: paidSum,
      sheetTotal: block.sheetTotal, sheetMissing: block.sheetMissing,
    })
  }

  // --- income -------------------------------------------------------------
  // The PRESTAMOS column of the income sheets is the same borrowing the
  // CREDITOS tables already produced, seen from the other side. Writing it too
  // would count every loan twice, so it is deliberately dropped.
  for (const row of data.income) {
    if (!inRange(row.year, row.month)) continue
    if (row.loan && !row.income) { bump('ingresos.omitidoPrestamo'); continue }
    if (!row.income || row.income <= 0) continue
    if (row.isThirdParty) { bump('ingresos.omitidoTerceros'); continue }

    const owner = row.sheet === 'INGRESOS SANDRA' ? 'sandra' : 'bancolombia'
    const when = dayUTC(row.year, row.month, Math.min(row.day, 28))
    const amount = Math.round(row.income)

    if (row.isInternalTransfer) {
      const transferId = randomUUID()
      const from = accountId.get(owner)!
      const to = accountId.get(owner === 'sandra' ? 'bancolombia' : 'nequi')!
      transfers.push({
        id: transferId, tenantId: TENANT_ID,
        sourceAccountId: from, destinationAccountId: to,
        sourceAmountMinor: amount, destinationAmountMinor: amount,
        sourceCurrency: CURRENCY, destinationCurrency: CURRENCY,
      })
      for (const [acct, type] of [[from, 'expense'], [to, 'income']] as const)
        transactions.push({
          id: randomUUID(), tenantId: TENANT_ID, accountId: acct, type,
          amountMinor: amount, currency: CURRENCY,
          description: row.counterparty ?? 'Entre cuentas propias',
          occurredAt: when, transferId, source: 'manual', categoryId: null,
        })
      bump('transferencias.internas')
      continue
    }

    const cat = incomeCategory(row.counterparty)
    transactions.push({
      id: randomUUID(), tenantId: TENANT_ID, accountId: accountId.get(owner)!,
      type: 'income', amountMinor: amount, currency: CURRENCY,
      description: row.counterparty ?? 'Ingreso', occurredAt: when,
      source: 'manual', categoryId: cat ? categoryId.get(cat) ?? null : null,
    })
    bump(owner === 'sandra' ? 'ingresos.sandra' : 'ingresos.victor')
  }

  return { accounts, categories, rules, obligations, transfers, transactions, payments, notes, stats, perPeriod }
}
