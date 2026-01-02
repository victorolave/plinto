import { z } from 'zod'

export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseCurrency: z.string(),
  createdAt: z.string(),
})

export type TenantDto = z.infer<typeof TenantSchema>
