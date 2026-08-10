/**
 * Undoes the load.
 *
 * Deletes exactly the ids `load.ts --apply` recorded in its manifest, not
 * "everything in the tenant": if anything was created in Plinto after the load,
 * a blanket wipe would take that too. Deletion runs in dependency order inside
 * one transaction, so a failure leaves the tenant as it was.
 *
 *   npx ts-node scripts/import-spreadsheet/revert.ts
 *   npx ts-node scripts/import-spreadsheet/revert.ts --dry-run
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { TENANT_ID } from './plan'

type Manifest = {
  tenantId: string
  writtenAt: string
  ids: Record<string, string[]>
}

async function main() {
  const path = `${__dirname}/manifest.json`
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as Manifest

  if (manifest.tenantId !== TENANT_ID)
    throw new Error(`El manifiesto es de otro tenant (${manifest.tenantId}). Abortado.`)

  console.log(`\n  manifiesto de ${manifest.writtenAt}`)
  for (const [k, ids] of Object.entries(manifest.ids))
    console.log(`    ${k.padEnd(14)} ${String(ids.length).padStart(6)}`)

  if (process.argv.includes('--dry-run')) {
    console.log('\n  DRY RUN. Nada borrado.\n')
    return
  }

  const prisma = new PrismaClient()
  const scoped = (ids: string[]) => ({ where: { id: { in: ids }, tenantId: TENANT_ID } })
  try {
    // Children before parents; every filter is also scoped by tenant, so a
    // stale id from another household could not be reached even by accident.
    const removed = await prisma.$transaction([
      prisma.obligationPayment.deleteMany(scoped(manifest.ids.payments)),
      prisma.obligationInstance.deleteMany(scoped(manifest.ids.obligations)),
      prisma.transaction.deleteMany(scoped(manifest.ids.transactions)),
      prisma.transfer.deleteMany(scoped(manifest.ids.transfers)),
      prisma.recurringTransactionRule.deleteMany(scoped(manifest.ids.rules)),
      prisma.category.deleteMany(scoped(manifest.ids.categories)),
      prisma.account.deleteMany(scoped(manifest.ids.accounts)),
    ])
    console.log(`\n  filas borradas: ${removed.reduce((a, r) => a + r.count, 0)}\n`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('\n' + e.message + '\n')
  process.exit(1)
})
