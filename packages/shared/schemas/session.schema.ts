import { z } from 'zod'

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tenantId: z.string().nullable().optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
})

export type SessionDto = z.infer<typeof SessionSchema>
