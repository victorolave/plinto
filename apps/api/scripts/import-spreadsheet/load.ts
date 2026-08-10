/**
 * Writes the planned rows into the `Olaves` tenant.
 *
 * Dry run by default: it prints what it would write and reconciles every month
 * against the spreadsheet's own TOTAL before anything touches the database.
 * `--apply` performs the load and records every created id in a manifest, which
 * is what `revert.ts` reads.
 *
 *   npx ts-node scripts/import-spreadsheet/load.ts data.json
 *   npx ts-node scripts/import-spreadsheet/load.ts data.json --apply
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { buildPlan, KNOWN_SHEET_DEFECTS, TENANT_ID, type Extract, type Plan, type Row } from './plan'

const OTHER_TENANT = '26c57550-1a88-4cc4-9ddc-bb840900dfec'

const money = (n: number) => n.toLocaleString('es-CO')

function report(plan: Plan): boolean {
  const debtAccounts = plan.accounts.filter((a) => a.type === 'debt')
  console.log('\n=== LO QUE SE VA A ESCRIBIR ============================\n')
  console.log(`  cuentas               ${plan.accounts.length}  (${debtAccounts.length} de tipo debt)`)
  console.log(`  categorías            ${plan.categories.length}`)
  console.log(`  reglas recurrentes    ${plan.rules.length}`)
  console.log(`  obligaciones          ${plan.obligations.length}`)
  console.log(`  transferencias        ${plan.transfers.length}`)
  console.log(`  transacciones         ${plan.transactions.length}`)
  console.log(`  pagos de obligación   ${plan.payments.length}`)

  console.log('\n  desglose:')
  for (const [k, v] of Object.entries(plan.stats).sort())
    console.log(`    ${k.padEnd(30)} ${String(v).padStart(6)}`)

  console.log('\n  reglas recurrentes (monto = el más frecuente; el real va en cada obligación):')
  for (const r of plan.rules)
    console.log(`    ${String(r.name).padEnd(22)} ${money(r.amountMinor as number).padStart(12)}`)

  console.log('\n  cuentas de deuda creadas por prestamista:')
  console.log('    ' + debtAccounts.map((a) => a.name).join(', '))

  console.log('\n=== RECONCILIACIÓN CONTRA LA PLANILLA ==================\n')
  console.log('  Dos comprobaciones por mes: que lo esperado sume el TOTAL de la hoja,')
  console.log('  y que lo que queda sin pagar sea el FALTANTES que la hoja declara.\n')
  console.log('  periodo    esperado(plan)   TOTAL(hoja)     delta      sinPagar(plan)  FALTANTES(hoja)   delta')
  let bad = 0
  const explained: string[] = []
  for (const [p, v] of [...plan.perPeriod.entries()].sort()) {
    const dTotal = v.sheetTotal === null ? 0 : v.expected - v.sheetTotal
    const unpaid = v.expected - v.paid
    const dMissing = v.sheetMissing === null ? 0 : unpaid - v.sheetMissing
    const known = KNOWN_SHEET_DEFECTS[p]
    if (known && known.delta === dTotal && dMissing === 0) explained.push(`${p}: ${known.why}`)
    else if (dTotal !== 0 || dMissing !== 0) bad++
    console.log(
      `  ${p}   ${money(v.expected).padStart(13)}   ${money(v.sheetTotal ?? 0).padStart(12)}` +
      ` ${money(dTotal).padStart(9)}${dTotal ? ' <<' : '   '}` +
      `   ${money(unpaid).padStart(13)}   ${money(v.sheetMissing ?? 0).padStart(13)}` +
      ` ${money(dMissing).padStart(9)}${dMissing ? ' <<' : ''}`,
    )
  }

  if (explained.length) {
    console.log('\n=== DEFECTOS CONOCIDOS DE LA HOJA (se carga el dato real) ===\n')
    for (const e of explained) console.log('  · ' + e)
  }

  if (plan.notes.length) {
    console.log('\n=== NOTAS =============================================\n')
    for (const n of plan.notes) console.log('  · ' + n)
  }

  console.log(`\n  meses que no cuadran sin explicación: ${bad} de ${plan.perPeriod.size}`)
  return bad === 0
}

async function apply(prisma: PrismaClient, plan: Plan) {
  // The other household must never be reachable from here. Asserting it costs
  // nothing and the alternative is discovering a mistake after the fact.
  const rows = [...plan.accounts, ...plan.categories, ...plan.rules,
    ...plan.obligations, ...plan.transfers, ...plan.transactions, ...plan.payments]
  if (rows.some((r) => r.tenantId !== TENANT_ID))
    throw new Error('Hay filas fuera del tenant Olaves. Abortado.')
  if (rows.some((r) => r.tenantId === OTHER_TENANT))
    throw new Error('Hay filas apuntando a "Olave Fam". Abortado.')

  console.log('\n=== BORRANDO EL TENANT Olaves =========================\n')
  // One statement at a time rather than a single $transaction: the pooled
  // Prisma Postgres endpoint drops a batch this long, and since the tenant is
  // being rebuilt from scratch anyway, a re-run after a partial wipe is
  // harmless. Children first, so no foreign key is ever left dangling.
  const wipes: [string, () => Promise<{ count: number }>][] = [
    ['obligationPayment', () => prisma.obligationPayment.deleteMany({ where: { tenantId: TENANT_ID } })],
    ['obligationInstance', () => prisma.obligationInstance.deleteMany({ where: { tenantId: TENANT_ID } })],
    ['recurringExecution', () => prisma.recurringTransactionExecution.deleteMany({ where: { tenantId: TENANT_ID } })],
    ['transaction', () => prisma.transaction.deleteMany({ where: { tenantId: TENANT_ID } })],
    ['transfer', () => prisma.transfer.deleteMany({ where: { tenantId: TENANT_ID } })],
    ['debtSchedule', () => prisma.debtSchedule.deleteMany({ where: { tenantId: TENANT_ID } })],
    ['recurringRule', () => prisma.recurringTransactionRule.deleteMany({ where: { tenantId: TENANT_ID } })],
    ['category', () => prisma.category.deleteMany({ where: { tenantId: TENANT_ID } })],
    ['account', () => prisma.account.deleteMany({ where: { tenantId: TENANT_ID } })],
  ]
  for (const [name, run] of wipes) {
    const { count } = await run()
    if (count) console.log(`  ${name.padEnd(20)} -${String(count).padStart(5)}`)
  }

  console.log('\n=== ESCRIBIENDO =======================================\n')
  // Insertion order is the dependency order: an obligation cannot reference a
  // rule that is not there, and a payment cannot reference either.
  const steps: [string, Row[], (rows: Row[]) => Promise<{ count: number }>][] = [
    ['accounts', plan.accounts, (r) => prisma.account.createMany({ data: r as never })],
    ['categories', plan.categories, (r) => prisma.category.createMany({ data: r as never })],
    ['rules', plan.rules, (r) => prisma.recurringTransactionRule.createMany({ data: r as never })],
    ['obligations', plan.obligations, (r) => prisma.obligationInstance.createMany({ data: r as never })],
    ['transfers', plan.transfers, (r) => prisma.transfer.createMany({ data: r as never })],
    ['transactions', plan.transactions, (r) => prisma.transaction.createMany({ data: r as never })],
    ['payments', plan.payments, (r) => prisma.obligationPayment.createMany({ data: r as never })],
  ]
  const CHUNK = 200 // the same pooler that refused the long delete batch
  for (const [name, rows, run] of steps) {
    let written = 0
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { count } = await run(rows.slice(i, i + CHUNK))
      written += count
    }
    console.log(`  ${name.padEnd(14)} ${String(written).padStart(6)}`)
  }

  const manifest = {
    tenantId: TENANT_ID,
    writtenAt: new Date().toISOString(),
    counts: Object.fromEntries(
      Object.entries(plan).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).length]),
    ),
    ids: Object.fromEntries(
      (['accounts', 'categories', 'rules', 'obligations', 'transfers', 'transactions', 'payments'] as const)
        .map((k) => [k, (plan[k] as { id: string }[]).map((r) => r.id)]),
    ),
  }
  const path = `${__dirname}/manifest.json`
  writeFileSync(path, JSON.stringify(manifest, null, 1))
  console.log(`\n  manifiesto: ${path}`)
}

async function main() {
  const [file, ...flags] = process.argv.slice(2)
  if (!file) throw new Error('Falta el data.json')
  const data = JSON.parse(readFileSync(file, 'utf8')) as Extract
  const plan = buildPlan(data)
  const clean = report(plan)

  if (!flags.includes('--apply')) {
    console.log('\n  DRY RUN. Nada escrito. Volvé a correr con --apply.\n')
    return
  }
  if (!clean && !flags.includes('--force'))
    throw new Error('Hay meses que no cuadran contra la planilla. Usá --force si es a propósito.')

  const prisma = new PrismaClient()
  try {
    await apply(prisma, plan)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('\n' + e.message + '\n')
  process.exit(1)
})
