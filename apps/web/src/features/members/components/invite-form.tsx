'use client'

import { type FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateInvitationSchema } from '@plinto/shared'
import { createInvitation, type InvitationResult } from '../services/invitations'
import type { MemberRole } from '../services/members'
import { queryKeys } from '../../../lib/api/query-keys'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'

const ROLE_OPTIONS: Array<{ value: MemberRole; label: string; hint: string }> = [
  { value: 'member', label: 'Member', hint: 'Can record and edit money movements' },
  { value: 'viewer', label: 'Viewer', hint: 'Can see everything, change nothing' },
  { value: 'owner', label: 'Owner', hint: 'Can also manage the household and its members' },
]

export interface InviteFormProps {
  /** Called after a successful invite, with what the API reported. */
  onInvited: (result: InvitationResult) => void
}

export function InviteForm({ onInvited }: InviteFormProps) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('member')
  const [validationError, setValidationError] = useState<string | null>(null)

  const inviteMutation = useMutation({
    mutationFn: (input: { email: string; role: MemberRole }) => createInvitation(input),
    onSuccess: (response) => {
      // Both lists can change: an accepted invitation adds a member, a pending
      // one adds a row to the invitations list.
      void queryClient.invalidateQueries({ queryKey: queryKeys.members })
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations })
      setEmail('')
      setRole('member')
      onInvited(response.data)
    },
  })

  const submitting = inviteMutation.isPending
  const error =
    validationError ??
    (inviteMutation.error instanceof Error ? inviteMutation.error.message : null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    // The shared schema trims and lower-cases, so the value validated here is
    // exactly the one the API will store — no second normalisation downstream.
    const result = CreateInvitationSchema.safeParse({ email, role })
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Invalid invitation')
      return
    }

    setValidationError(null)
    inviteMutation.mutate(result.data)
  }

  const selectedHint = ROLE_OPTIONS.find((option) => option.value === role)?.hint

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <Field
          label="Email"
          hint="They do not need a Plinto account yet"
          htmlFor="invite-email"
        >
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="e.g. sandra@example.com"
            required
          />
        </Field>

        <Field label="Role" hint={selectedHint} htmlFor="invite-role">
          <Select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value as MemberRole)}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <p className="muted">
          If that address already has a Plinto account they join right away.
          Otherwise the invitation waits for their first sign-in, and expires
          after 14 days.
        </p>

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting}>
          {submitting ? 'Sending…' : 'Send invitation'}
        </Button>
      </div>
    </form>
  )
}
