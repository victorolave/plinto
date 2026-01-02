import { z } from 'zod'

export const UpdateProfileSchema = z.object({
  name: z.string().min(1),
})

export const CreateTenantSchema = z.object({
  name: z.string().min(1),
  baseCurrency: z.string().trim().min(1).optional(),
})

export const SelectTenantSchema = z.object({
  tenantId: z.string().min(1),
})

export const CreateSessionSchema = z.object({
  idpSub: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).optional().nullable(),
})

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>
export type CreateTenantDto = z.infer<typeof CreateTenantSchema>
export type SelectTenantDto = z.infer<typeof SelectTenantSchema>
export type CreateSessionDto = z.infer<typeof CreateSessionSchema>
