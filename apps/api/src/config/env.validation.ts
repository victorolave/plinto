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
  // In-process scheduler (ADR 0006 amendment) — off by default. See
  // configuration.ts for the defaults applied when these are unset.
  JOBS_SCHEDULER_ENABLED: z.enum(['true', 'false']).optional(),
  JOBS_CRON: z.string().min(1).optional(),
  JOBS_TIMEZONE: z.string().min(1).optional(),
  JOBS_HORIZON_MONTHS: z
    .string()
    .regex(/^([1-9]|1[0-2])$/, 'JOBS_HORIZON_MONTHS must be an integer between 1 and 12')
    .optional(),
})

export type EnvVars = z.infer<typeof envSchema>

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config)
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`)
  }
  return result.data
}
