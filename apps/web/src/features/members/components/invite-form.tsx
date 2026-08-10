'use client'

import { type FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { CreateInvitationSchema } from '@plinto/shared'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import { useValidationMessage } from '../../../lib/api/use-validation-message'
import { createInvitation, type InvitationResult } from '../services/invitations'
import type { MemberRole } from '../services/members'
import { queryKeys } from '../../../lib/api/query-keys'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'

/**
 * The order the role dropdown offers. `member` first because it is the role
 * most invitations use. Labels come from `members.role.*` and the hint under
 * the field from `members.inviteHint.*`.
 */
const ROLE_OPTIONS: MemberRole[] = ['member', 'viewer', 'owner']

export interface InviteFormProps {
  /** Called after a successful invite, with what the API reported. */
  onInvited: (result: InvitationResult) => void
}

export function InviteForm({ onInvited }: InviteFormProps) {
  const t = useTranslations('members')
  const toErrorMessage = useErrorMessage()
  const toValidationMessage = useValidationMessage()
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
  const error = validationError ?? toErrorMessage(inviteMutation.error)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    // The shared schema trims and lower-cases, so the value validated here is
    // exactly the one the API will store — no second normalisation downstream.
    const result = CreateInvitationSchema.safeParse({ email, role })
    if (!result.success) {
      setValidationError(
        toValidationMessage(result.error.issues[0]) ?? t('inviteForm.invalid'),
      )
      return
    }

    setValidationError(null)
    inviteMutation.mutate(result.data)
  }

  const selectedHint = t(`inviteHint.${role}`)

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <Field
          label={t('inviteForm.email')}
          hint={t('inviteForm.emailHint')}
          htmlFor="invite-email"
        >
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('inviteForm.emailPlaceholder')}
            required
          />
        </Field>

        <Field label={t('inviteForm.role')} hint={selectedHint} htmlFor="invite-role">
          <Select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value as MemberRole)}
          >
            {ROLE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`role.${value}`)}
              </option>
            ))}
          </Select>
        </Field>

        <p className="muted">{t('inviteForm.note')}</p>

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting}>
          {submitting ? t('inviteForm.sending') : t('inviteForm.send')}
        </Button>
      </div>
    </form>
  )
}
