import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { LoanService } from '../loan.service'

const account = (overrides = {}) => ({
  id: 'acc-bank',
  tenantId: 'tenant-1',
  name: 'Bancolombia',
  type: 'bank' as const,
  currency: 'COP',
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  ...overrides,
})

const lender = (overrides = {}) =>
  account({ id: 'acc-lineru', name: 'Lineru', type: 'debt', ...overrides })

describe('LoanService', () => {
  let accountRepo: { findByIdForTenant: ReturnType<typeof vi.fn> }
  let transactions: { createTransfer: ReturnType<typeof vi.fn> }
  let audit: { record: ReturnType<typeof vi.fn> }
  let service: LoanService

  const recordLoan = (overrides = {}) =>
    service.recordLoan({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      lenderAccountId: 'acc-lineru',
      destinationAccountId: 'acc-bank',
      amountMinor: 983000,
      ...overrides,
    })

  /** Resolves each id to whichever fixture carries it. */
  const resolving = (...accounts: Array<ReturnType<typeof account>>) =>
    vi.fn(async (id: string) => accounts.find((a) => a.id === id) ?? null)

  beforeEach(() => {
    accountRepo = { findByIdForTenant: resolving(lender(), account()) }
    transactions = {
      createTransfer: vi.fn().mockResolvedValue({
        transfer: { id: 'transfer-1' },
        debit: { id: 'tx-debit' },
        credit: { id: 'tx-credit' },
      }),
    }
    audit = { record: vi.fn().mockResolvedValue(undefined) }

    service = new LoanService(
      accountRepo as never,
      transactions as never,
      audit as never,
    )
  })

  /**
   * The distinction this whole slice exists for. Cash arriving from a lender is
   * not income — recording it as a movement from the liability account is what
   * keeps it out of the household's income figure structurally, rather than by
   * a convention somebody has to remember.
   */
  it('moves money from the lender, never recording income', async () => {
    await recordLoan()

    expect(transactions.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAccountId: 'acc-lineru',
        destinationAccountId: 'acc-bank',
        sourceAmountMinor: 983000,
      }),
    )
  })

  it('does not reimplement a transfer', async () => {
    const result = await recordLoan()

    // The ledger's own machinery produced these; this service only gave them
    // meaning.
    expect(result.transfer).toEqual({ id: 'transfer-1' })
    expect(result.debit).toEqual({ id: 'tx-debit' })
  })

  it('records that a debt was taken on, not merely that money moved', async () => {
    await recordLoan()

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'loan.received',
        resourceId: 'transfer-1',
        metadata: expect.objectContaining({
          lenderAccountId: 'acc-lineru',
          amountMinor: 983000,
          currency: 'COP',
        }),
      }),
    )
  })

  describe('what it refuses', () => {
    it('rejects a lender that is not a liability', async () => {
      accountRepo.findByIdForTenant = resolving(
        account({ id: 'acc-lineru', type: 'savings' }),
        account(),
      )

      await expect(recordLoan()).rejects.toBeInstanceOf(UnprocessableEntityException)
      expect(transactions.createTransfer).not.toHaveBeenCalled()
    })

    // A credit card is a liability too, so borrowing against one is a loan.
    it('accepts a credit account as the lender', async () => {
      accountRepo.findByIdForTenant = resolving(
        account({ id: 'acc-lineru', type: 'credit' }),
        account(),
      )

      await expect(recordLoan()).resolves.toBeDefined()
    })

    /**
     * Borrowing to pay off another debt is refinancing, which PRD-007 puts out
     * of scope. Rejecting it beats recording it as an ordinary loan and leaving
     * somebody to find out later that the model never understood them.
     */
    it('rejects a loan landing in another debt', async () => {
      accountRepo.findByIdForTenant = resolving(
        lender(),
        account({ id: 'acc-bank', type: 'debt' }),
      )

      await expect(recordLoan()).rejects.toBeInstanceOf(UnprocessableEntityException)
      expect(transactions.createTransfer).not.toHaveBeenCalled()
    })

    // Cross-currency borrowing needs a rate and a fee, which belongs to the
    // transfer contract and is not something to infer here.
    it('rejects a currency mismatch rather than guessing a rate', async () => {
      accountRepo.findByIdForTenant = resolving(
        lender({ currency: 'USD' }),
        account({ currency: 'COP' }),
      )

      await expect(recordLoan()).rejects.toBeInstanceOf(UnprocessableEntityException)
      expect(transactions.createTransfer).not.toHaveBeenCalled()
    })

    it.each([
      ['the lender', 'acc-lineru'],
      ['the destination', 'acc-bank'],
    ])('reports not found when %s does not belong to the tenant', async (_label, missing) => {
      accountRepo.findByIdForTenant = vi.fn(async (id: string) =>
        id === missing ? null : id === 'acc-lineru' ? lender() : account(),
      )

      await expect(recordLoan()).rejects.toBeInstanceOf(NotFoundException)
      expect(transactions.createTransfer).not.toHaveBeenCalled()
    })

    it('audits nothing when the loan was refused', async () => {
      accountRepo.findByIdForTenant = resolving(
        account({ id: 'acc-lineru', type: 'bank' }),
        account(),
      )

      await expect(recordLoan()).rejects.toThrow()
      expect(audit.record).not.toHaveBeenCalled()
    })
  })
})
