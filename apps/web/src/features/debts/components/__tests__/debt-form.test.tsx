import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { DebtForm } from '../debt-form'
import type { Account } from '../../../accounts/services/accounts'

vi.mock('../../services/debts')

import { createDebt } from '../../services/debts'

const mockedCreateDebt = vi.mocked(createDebt)

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-addi',
  tenantId: 'tenant-1',
  name: 'ADDI',
  type: 'debt',
  currency: 'COP',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  ...overrides,
})

/** Fills every required field; individual tests override what they care about. */
async function fill(
  user: ReturnType<typeof userEvent.setup>,
  values: { principal: string; installment: string; count: string },
) {
  await user.type(screen.getByLabelText(/what you bought/i), 'Nevera')
  await user.type(screen.getByLabelText(/total to repay/i), values.principal)
  await user.type(screen.getByLabelText(/each installment/i), values.installment)
  await user.clear(screen.getByLabelText(/how many/i))
  await user.type(screen.getByLabelText(/how many/i), values.count)
  await user.type(screen.getByLabelText(/first installment due/i), '2026-07-15')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedCreateDebt.mockResolvedValue({ data: { debt: {} as never } })
})

describe('DebtForm', () => {
  it('records the plan the lender quoted', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DebtForm accounts={[account()]} onSaved={vi.fn()} />)

    await fill(user, { principal: '600000', installment: '100000', count: '6' })
    await user.click(screen.getByRole('button', { name: /record purchase/i }))

    await waitFor(() =>
      expect(mockedCreateDebt).toHaveBeenCalledWith({
        accountId: 'acc-addi',
        name: 'Nevera',
        principalMinor: 600000,
        installmentMinor: 100000,
        installmentCount: 6,
        firstDueDate: '2026-07-15T00:00:00.000Z',
      }),
    )
  })

  /**
   * The real case from the source sheet: 4 × 59,505 against a credit of
   * 238,023 — three pesos short. The person entering it deserves to see where
   * the difference lands rather than discover it three months in.
   */
  it('shows what the last installment will actually charge', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DebtForm accounts={[account()]} onSaved={vi.fn()} />)

    await fill(user, { principal: '238023', installment: '59505', count: '4' })

    expect(await screen.findByText(/last installment will charge/i)).toBeInTheDocument()
    expect(screen.getByText(/59.508/)).toBeInTheDocument()
  })

  it('says nothing about the last installment when they all match', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DebtForm accounts={[account()]} onSaved={vi.fn()} />)

    await fill(user, { principal: '600000', installment: '100000', count: '6' })

    expect(screen.queryByText(/last installment will charge/i)).not.toBeInTheDocument()
  })

  /**
   * Installments that already cover the principal would leave the last one
   * empty — not a plan anybody agreed to. The shared schema refuses it, and the
   * form surfaces that instead of sending it.
   */
  it('refuses a plan whose last installment would be empty', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DebtForm accounts={[account()]} onSaved={vi.fn()} />)

    await fill(user, { principal: '600000', installment: '600000', count: '6' })
    await user.click(screen.getByRole('button', { name: /record purchase/i }))

    expect(await screen.findByText(/last one would be empty/i)).toBeInTheDocument()
    expect(mockedCreateDebt).not.toHaveBeenCalled()
  })

  // A plan pays down something owed, so only liabilities can carry one.
  it('only offers liability accounts as the lender', () => {
    renderWithProviders(
      <DebtForm
        accounts={[account(), account({ id: 'acc-bank', name: 'Bancolombia', type: 'bank' })]}
        onSaved={vi.fn()}
      />,
    )

    const select = screen.getByLabelText(/lender/i)
    expect(select).toHaveTextContent('ADDI')
    expect(select).not.toHaveTextContent('Bancolombia')
  })

  it('explains what is missing when the household holds no liability account', () => {
    renderWithProviders(
      <DebtForm accounts={[account({ id: 'acc-bank', type: 'bank' })]} onSaved={vi.fn()} />,
    )

    expect(screen.getByText(/need a debt or credit account first/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /record purchase/i })).toBeDisabled()
  })

  it('surfaces the API refusing the plan', async () => {
    const user = userEvent.setup()
    mockedCreateDebt.mockRejectedValue(
      new Error('A debt schedule must be attached to a debt or credit account'),
    )

    renderWithProviders(<DebtForm accounts={[account()]} onSaved={vi.fn()} />)

    await fill(user, { principal: '600000', installment: '100000', count: '6' })
    await user.click(screen.getByRole('button', { name: /record purchase/i }))

    expect(await screen.findByText(/must be attached to a debt/i)).toBeInTheDocument()
  })
})
