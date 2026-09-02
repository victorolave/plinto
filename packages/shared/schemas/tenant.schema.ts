import { z } from 'zod'

export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseCurrency: z.string(),
  /** True for the example household: invented Colombian sample data, never real data. */
  isDemo: z.boolean(),
  createdAt: z.string(),
})

export type TenantDto = z.infer<typeof TenantSchema>
