import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { SUPPORTED_CURRENCIES } from '@plinto/shared'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { AccountForm } from '../account-form'

/**
 * The parent panel owns the mutations; this form only validates and calls
 * `.mutate`. A stub with the three members the component reads is enough, and
 * keeps the test about the field rather than about TanStack Query.
 */
function stubMutation() {
  return { mutate: vi.fn(), error: null, isPending: false } as never
}

function renderForm() {
  return renderWithProviders(
    <AccountForm
      editing={null}
      createMutation={stubMutation()}
      updateMutation={stubMutation()}
    />,
  )
}

/**
 * The account form is the only hand-entry point for a currency in Plinto, so
 * free text here was how `XXX` reached a stored row. The contract now rejects
 * unknown codes; this pins the field to offer only what the contract accepts,
 * so the two cannot drift apart.
 */
describe('AccountForm currency field', () => {
  it('is a select, not a free-text input', () => {
    renderForm()

    expect(screen.getByLabelText('Currency').tagName).toBe('SELECT')
  })

  it('offers every supported currency and nothing else', () => {
    renderForm()

    const options = Array.from(
      screen.getByLabelText('Currency').querySelectorAll('option'),
    ).map((option) => option.getAttribute('value'))

    expect(options).toEqual([...SUPPORTED_CURRENCIES])
  })

  it('defaults to COP, the currency a Plinto household starts in', () => {
    renderForm()

    expect(screen.getByLabelText('Currency')).toHaveValue('COP')
  })
})
