import { z } from 'zod'

// OIDC is handled entirely by the web BFF (see ADR 0003); the API only ever
// consumes an already-authenticated identity via the internal key, so it does
// not declare or read any OIDC_* variables.
const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  INTERNAL_API_KEY: z.string().min(1),
  WEB_ORIGIN: z.string().url().optional(),
  DATABASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1).optional(),
})

export type EnvVars = z.infer<typeof envSchema>

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config)
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`)
  }
  return result.data
}
