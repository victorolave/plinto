'use client'

import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createTenant, updateProfile } from '../services/onboarding'
import { Button } from '../../../components/ui/button'
import { Field, Input } from '../../../components/ui/field'

export function OnboardingForm() {
  const [name, setName] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('COP')

  // Profile then household are a two-step sequence; wrap both in one mutation so
  // the button state and error surface come from React Query, not hand-rolled.
  const submitMutation = useMutation({
    mutationFn: async () => {
      await updateProfile(name)
      await createTenant(tenantName, baseCurrency)
    },
    onSuccess: () => {
      window.location.href = '/dashboard'
    },
  })

  const loading = submitMutation.isPending
  const error =
    submitMutation.error instanceof Error ? submitMutation.error.message : null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    submitMutation.mutate()
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
