import { z, ZodTypeAny } from 'zod'

export const dataResponseSchema = <T extends ZodTypeAny>(schema: T) =>
  z.object({
    data: schema,
  })
