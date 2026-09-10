import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { SUPPORTED_CURRENCIES } from '@plinto/shared'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { OnboardingForm } from '../onboarding-form'

/**
 * This field sets `Tenant.baseCurrency` and is the very first thing a new
 * household touches. It used to be free text against a contract that accepted
 * any non-empty string, so a household could be created holding "banana".
 *
 * Now that the contract only accepts the allow-list, leaving the field as free
 * text would be worse than the original bug: a typo would fail at the API on
 * the first screen of the product, with nothing on the form explaining what a
 * valid answer looks like. The picker is what keeps the tightened contract
 * unreachable by accident.
 */
describe('OnboardingForm base currency field', () => {
  it('is a select, not a free-text input', () => {
    renderWithProviders(<OnboardingForm />)

    expect(screen.getByLabelText('Base currency').tagName).toBe('SELECT')
  })

  it('offers every supported currency and nothing else', () => {
    renderWithProviders(<OnboardingForm />)

    const options = Array.from(
      screen.getByLabelText('Base currency').querySelectorAll('option'),
    ).map((option) => option.getAttribute('value'))

    expect(options).toEqual([...SUPPORTED_CURRENCIES])
  })

  it('defaults to COP', () => {
    renderWithProviders(<OnboardingForm />)

    expect(screen.getByLabelText('Base currency')).toHaveValue('COP')
  })
})
