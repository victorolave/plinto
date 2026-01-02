import { Issuer } from 'openid-client'

export async function getOidcClient() {
  const issuerUrl = process.env.OIDC_ISSUER_URL
  const clientId = process.env.OIDC_CLIENT_ID
  const clientSecret = process.env.OIDC_CLIENT_SECRET
  const redirectUri = process.env.OIDC_REDIRECT_URI

  if (!issuerUrl || !clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing OIDC configuration')
  }

  const issuer = await Issuer.discover(issuerUrl)
  return new issuer.Client({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: [redirectUri],
    response_types: ['code'],
  })
}
