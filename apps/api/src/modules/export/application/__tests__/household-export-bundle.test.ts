import { describe, expect, it } from 'vitest'
import { buildHouseholdExportBundle } from '../household-export-bundle'
import type { HouseholdExportData } from '../../domain/household-export.entity'

function buildData(overrides: Partial<HouseholdExportData> = {}): HouseholdExportData {
  return {
    tenant: {
      id: 'tenant-1',
      name: 'Casa Olave',
      baseCurrency: 'COP',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    },
    members: [
      {
        userId: 'user-1',
        email: 'victor@example.com',
        name: 'Victor',
        role: 'owner',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    ],
    categories: [],
    accounts: [
      {
        id: 'account-1',
        tenantId: 'tenant-1',
        name: 'Cuenta principal',
        type: 'bank',
        currency: 'USD',
        createdAt: new Date('2025-01-02T00:00:00.000Z'),
        updatedAt: new Date('2025-01-02T00:00:00.000Z'),
        archivedAt: null,
      },
    ],
    creditLines: [],
    creditLineStatements: [],
    debtSchedules: [],
    recurringRules: [],
    transfers: [],
    transactions: [],
    recurringExecutions: [],
    obligationInstances: [],
    obligationPayments: [],
    auditEvents: [],
    ...overrides,
  }
}

describe('buildHouseholdExportBundle', () => {
  it('stamps the documented format and version', () => {
    const bundle = buildHouseholdExportBundle(buildData(), new Date('2026-09-02T10:00:00.000Z'))

    expect(bundle.format).toBe('plinto-household-export')
    expect(bundle.version).toBe(1)
    expect(bundle.exportedAt).toBe('2026-09-02T10:00:00.000Z')
    expect(bundle.generator.app).toBe('plinto')
    expect(typeof bundle.generator.apiVersion).toBe('string')
    expect(bundle.generator.apiVersion.length).toBeGreaterThan(0)
  })

  it('has exactly the documented top-level keys', () => {
    const bundle = buildHouseholdExportBundle(buildData(), new Date())

    expect(Object.keys(bundle).sort()).toEqual(
      [
        'format',
        'version',
        'exportedAt',
        'generator',
        'money',
        'tenant',
        'members',
        'categories',
        'accounts',
        'creditLines',
        'creditLineStatements',
        'debtSchedules',
        'recurringRules',
        'transfers',
        'transactions',
        'recurringExecutions',
        'obligationInstances',
        'obligationPayments',
        'auditEvents',
      ].sort(),
    )
  })

  it('collects the currency of every table that carries one, exponent included', () => {
    const bundle = buildHouseholdExportBundle(buildData(), new Date())

    // Base currency (COP, exponent 0) and the one account's own currency
    // (USD, exponent 2) must both appear, even though nothing else uses them.
    expect(bundle.money.currencies).toEqual({
      COP: { exponent: 0 },
      USD: { exponent: 2 },
    })
  })

  it('renders every date as an ISO string, never a Date instance', () => {
    const bundle = buildHouseholdExportBundle(buildData(), new Date())

    expect(bundle.tenant.createdAt).toBe('2025-01-01T00:00:00.000Z')
    expect(bundle.accounts[0].createdAt).toBe('2025-01-02T00:00:00.000Z')
    expect(bundle.accounts[0].archivedAt).toBeNull()
  })

  it('narrows tenant and member rows to their documented shape', () => {
    const bundle = buildHouseholdExportBundle(buildData(), new Date())

    expect(Object.keys(bundle.tenant).sort()).toEqual(
      ['id', 'name', 'baseCurrency', 'createdAt'].sort(),
    )
    expect(Object.keys(bundle.members[0]).sort()).toEqual(
      ['userId', 'email', 'name', 'role', 'createdAt'].sort(),
    )
  })

  it('preserves the order the repository already sorted rows in', () => {
    const bundle = buildHouseholdExportBundle(
      buildData({
        categories: [
          {
            id: 'cat-2',
            tenantId: 'tenant-1',
            name: 'Second',
            type: 'expense',
            color: null,
            createdAt: new Date('2025-01-02T00:00:00.000Z'),
            updatedAt: new Date('2025-01-02T00:00:00.000Z'),
          },
          {
            id: 'cat-1',
            tenantId: 'tenant-1',
            name: 'First',
            type: 'expense',
            color: null,
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            updatedAt: new Date('2025-01-01T00:00:00.000Z'),
          },
        ],
      }),
      new Date(),
    )

    // The repository is the sorting authority (createdAt asc, id asc); the
    // bundle builder must not silently re-sort behind its back.
    expect(bundle.categories.map((c) => c.id)).toEqual(['cat-2', 'cat-1'])
  })

  it('renders a Decimal-turned-string fxRate as-is, and a null one as null', () => {
    const bundle = buildHouseholdExportBundle(
      buildData({
        transfers: [
          {
            id: 'transfer-1',
            tenantId: 'tenant-1',
            sourceAccountId: 'a',
            destinationAccountId: 'b',
            sourceAmountMinor: 100,
            destinationAmountMinor: 100,
            sourceCurrency: 'COP',
            destinationCurrency: 'COP',
            fxRate: null,
            feeMinor: null,
            rateSource: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'transfer-2',
            tenantId: 'tenant-1',
            sourceAccountId: 'a',
            destinationAccountId: 'b',
            sourceAmountMinor: 100,
            destinationAmountMinor: 90,
            sourceCurrency: 'USD',
            destinationCurrency: 'COP',
            fxRate: '4000.12345678',
            feeMinor: 10,
            rateSource: 'manual',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }),
      new Date(),
    )

    expect(bundle.transfers[0].fxRate).toBeNull()
    expect(bundle.transfers[1].fxRate).toBe('4000.12345678')
  })
})
