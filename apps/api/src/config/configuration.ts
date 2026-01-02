export const configuration = () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  oidcIssuerUrl: process.env.OIDC_ISSUER_URL ?? '',
  oidcClientId: process.env.OIDC_CLIENT_ID ?? '',
  oidcClientSecret: process.env.OIDC_CLIENT_SECRET ?? '',
  oidcRedirectUri: process.env.OIDC_REDIRECT_URI ?? '',
  internalApiKey: process.env.INTERNAL_API_KEY ?? '',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
})
