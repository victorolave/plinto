'use client'

import { useState } from 'react'
import { createTenant, updateProfile } from '../services/onboarding'
import { Button } from '../../../components/ui/button'
import { Field, Input } from '../../../components/ui/field'

export function OnboardingForm() {
  const [name, setName] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('COP')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await updateProfile(name)
      await createTenant(tenantName, baseCurrency)
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <Field label="Your name" htmlFor="onboarding-name">
        <Input
          id="onboarding-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Marta Ruiz"
          required
        />
      </Field>
      <Field label="Household name" htmlFor="onboarding-tenant">
        <Input
          id="onboarding-tenant"
          value={tenantName}
          onChange={(event) => setTenantName(event.target.value)}
          placeholder="e.g. Ruiz Family"
          required
        />
      </Field>
      <Field
        label="Base currency"
        hint="The default currency for this household."
        htmlFor="onboarding-currency"
      >
        <Input
          id="onboarding-currency"
          value={baseCurrency}
          onChange={(event) => setBaseCurrency(event.target.value)}
          maxLength={3}
        />
      </Field>
      {error ? <p className="error-text">{error}</p> : null}
      <Button type="submit" disabled={loading} block>
        {loading ? 'Submitting…' : 'Continue'}
      </Button>
    </form>
  )
}
