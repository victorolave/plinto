'use client'

import { useState } from 'react'
import { createTenant, updateProfile } from '../services/onboarding'

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
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <label className="label">
        Your name
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label className="label">
        Tenant name
        <input
          className="input"
          value={tenantName}
          onChange={(event) => setTenantName(event.target.value)}
          required
        />
      </label>
      <label className="label">
        Base currency
        <input
          className="input"
          value={baseCurrency}
          onChange={(event) => setBaseCurrency(event.target.value)}
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={loading} className="button">
        {loading ? 'Submitting...' : 'Continue'}
      </button>
    </form>
  )
}
