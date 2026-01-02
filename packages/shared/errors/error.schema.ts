import { z } from 'zod'

export const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.array(z.unknown()).optional(),
  traceId: z.string().optional(),
})

export const ErrorResponseSchema = z.object({
  error: ErrorSchema,
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
