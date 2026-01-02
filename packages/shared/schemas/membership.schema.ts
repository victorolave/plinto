import { z } from 'zod'

export const MembershipSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  role: z.enum(['owner', 'member', 'viewer']),
  createdAt: z.string(),
})

export type MembershipDto = z.infer<typeof MembershipSchema>
