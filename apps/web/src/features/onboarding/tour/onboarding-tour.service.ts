import type { UserDto } from '@plinto/shared'
import { apiFetch } from '../../../lib/api/client'

/**
 * Marks the product tour as seen for the authenticated user. The API is
 * idempotent (the timestamp is only stamped the first time), so calling this
 * more than once — e.g. replaying the tour from the help button — is safe
 * and never resets or moves the original "first login" timestamp.
 */
export async function markTourSeen(): Promise<UserDto> {
  const response = await apiFetch<{ data: UserDto }>('/me/onboarding-tour/seen', {
    method: 'POST',
  })
  return response.data
}
