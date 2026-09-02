export const configuration = () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  internalApiKey: process.env.INTERNAL_API_KEY ?? '',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  // In-process scheduler (ADR 0006 amendment). Disabled by default: enabling
  // it is an explicit per-instance decision (exactly one replica should run
  // it), not something a fresh deploy should do on its own.
  jobs: {
    schedulerEnabled: process.env.JOBS_SCHEDULER_ENABLED === 'true',
    cron: process.env.JOBS_CRON ?? '0 6 * * *',
    timezone: process.env.JOBS_TIMEZONE ?? 'America/Bogota',
    horizonMonths: process.env.JOBS_HORIZON_MONTHS
      ? Number(process.env.JOBS_HORIZON_MONTHS)
      : 3,
  },
})
